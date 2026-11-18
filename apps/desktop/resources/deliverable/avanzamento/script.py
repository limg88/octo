"""Modulo di avanzamento per posizione d'ordine.

Legge config.json (ordine, posizioni, richieste, mappa delle celle del modulo) e parametri.json
(il numero della richiesta), calcola la quota di ogni posizione dopo ogni richiesta e dice a Octo
che cosa scrivere nel modulo del cliente. Il modulo lo compila Octo, che ne conserva logo, celle
unite e formati: questo script non apre il file Excel.

Scrive nella cartella in cui gira: esito.json (per Octo) e uscita/quote.csv.
"""
import csv
import json
import os
import re
from decimal import ROUND_HALF_UP, Decimal

CENT = 0.01


def fixed(value, decimals):
    """Arrotonda come il modulo ha sempre fatto: sul valore esatto, la metà va verso l'alto."""
    step = Decimal(1).scaleb(-decimals)
    # Più zero: un meno zero resta zero, come nel modulo.
    return float(Decimal(value).quantize(step, rounding=ROUND_HALF_UP)) + 0.0


def cents(value):
    return fixed(value, 2)


def share(value):
    return fixed(value, 4)


def compute(positions, requests):
    """La quota di ogni posizione dopo ogni richiesta. L'importo chiesto riempie le posizioni
    una dopo l'altra, sempre dal totale chiesto fin lì e mai sommando passi arrotondati."""
    total = cents(sum(position["amount"] for position in positions))
    if not positions:
        return {"ok": False, "total": total, "problem": {"kind": "no_positions"}}
    codes = [position["code"] for position in positions]
    filled = [0.0 for _ in positions]
    steps = []
    previous = [0.0 for _ in positions]
    cumulative = 0.0
    for request in requests:
        cumulative = cents(cumulative + request["amount"])
        if cumulative - total > CENT:
            problem = {"kind": "over_total", "n": request["n"], "excess": cents(cumulative - total)}
            return {"ok": False, "total": total, "problem": problem}
        unknown = [code for code in request["positions"] if code not in codes]
        if unknown:
            problem = {"kind": "unknown_positions", "n": request["n"], "codes": unknown}
            return {"ok": False, "total": total, "problem": problem}
        named = len(request["positions"]) > 0
        # Senza posizioni nominate tutto il chiesto fin qui si riversa di nuovo dalla prima.
        left = request["amount"] if named else cumulative
        if not named:
            filled = [0.0 for _ in positions]
        targets = [codes.index(code) for code in request["positions"]] if named else range(len(positions))
        for index in targets:
            room = cents(positions[index]["amount"] - filled[index])
            poured = min(room, left)
            filled[index] = cents(filled[index] + poured)
            left = cents(left - poured)
        if left > CENT:
            problem = {"kind": "over_positions", "n": request["n"], "excess": left}
            return {"ok": False, "total": total, "problem": problem}
        closing = abs(cumulative - total) < CENT
        current = [
            1 if closing else share(filled[index] / position["amount"])
            for index, position in enumerate(positions)
        ]
        rebuilt = 0.0
        for index, value in enumerate(current):
            rebuilt = rebuilt + value * positions[index]["amount"]
        steps.append(
            {
                "request": request,
                "cumulative": cumulative,
                "closing": closing,
                "previous": previous,
                "current": current,
                "period": [share(value - previous[index]) for index, value in enumerate(current)],
                "rebuilt": cents(rebuilt),
            }
        )
        previous = current
    return {"ok": True, "total": total, "steps": steps}


def form_day(day):
    """2026-06-30 come lo scrive il modulo: 30/06/2026."""
    return "/".join(reversed(day.split("-")))


PLACEHOLDER = re.compile(r"\{([a-z_]+)\}")


def form_cells(config, step, previous_to):
    """Che cosa scrivere nel modulo per una richiesta: i campi della mappa con i nomi sostituiti
    e una riga della tabella per posizione; le righe che l'ordine non usa restano vuote."""
    positions = config["positions"]
    form = config["form"]
    request = step["request"]
    touched = request["positions"] if request["positions"] else [p["code"] for p in positions]
    if len(touched) > 1:
        covered = touched[0] + ":" + touched[-1]
    else:
        covered = touched[0] if touched else ""
    values = {
        "n": str(request["n"]),
        "ordine": config["order"],
        "posizioni": covered,
        "dal": form_day(request["from"]),
        "al": form_day(request["to"]),
        "al_precedente": form_day(previous_to),
        "nota": request["note"],
    }
    writes = []
    for field in form["fields"]:
        if field["text"] == "{n}":
            cell = {"kind": "number", "value": request["n"]}
        else:
            text = PLACEHOLDER.sub(lambda found: values.get(found.group(1), found.group(0)), field["text"])
            cell = {"kind": "text", "value": text}
        writes.append({"ref": field["ref"], "cell": cell})
    table = form.get("table")
    if table is not None:
        if len(positions) > table["rows"]:
            return None, "Il modulo ha %d righe per le posizioni e l'ordine ne ha %d." % (
                table["rows"],
                len(positions),
            )
        for index in range(table["rows"]):
            row = table["firstRow"] + index
            position = positions[index] if index < len(positions) else None

            def number(shares):
                if position is None:
                    return {"kind": "empty"}
                return {"kind": "number", "value": shares[index], "percent": True}

            writes.append(
                {
                    "ref": "%s%d" % (table["position"], row),
                    "cell": {"kind": "empty"} if position is None else {"kind": "text", "value": position["code"]},
                }
            )
            writes.append({"ref": "%s%d" % (table["previous"], row), "cell": number(step["previous"])})
            writes.append({"ref": "%s%d" % (table["current"], row), "cell": number(step["current"])})
            writes.append({"ref": "%s%d" % (table["period"], row), "cell": number(step["period"])})
    return writes, None


def money(value):
    return ("%.2f" % value).replace(".", ",")


def problem_text(problem):
    kind = problem["kind"]
    if kind == "no_positions":
        return "L'ordine non ha posizioni: scrivile nella configurazione."
    if kind == "over_total":
        return "La richiesta %d supera il totale dell'ordine di %s." % (problem["n"], money(problem["excess"]))
    if kind == "unknown_positions":
        return "La richiesta %d nomina posizioni che l'ordine non ha: %s." % (
            problem["n"],
            ", ".join(problem["codes"]),
        )
    return "La richiesta %d supera ciò che resta sulle posizioni nominate di %s." % (
        problem["n"],
        money(problem["excess"]),
    )


def warnings(config):
    """Ciò che va guardato prima di mandare il modulo; niente di questo ferma il calcolo."""
    found = []
    total = cents(sum(position["amount"] for position in config["positions"]))
    declared = config.get("total")
    if declared is not None and abs(declared - total) >= CENT:
        found.append(
            "Il totale dichiarato dell'ordine (%s) non è la somma delle posizioni (%s)."
            % (money(declared), money(total))
        )
    requests = config["requests"]
    for index, request in enumerate(requests):
        before = requests[index - 1] if index > 0 else None
        if request["from"] == "" or request["to"] == "":
            found.append("Richiesta %d: mancano le date." % request["n"])
        elif before is not None and before["to"] != "" and before["to"] != request["from"]:
            found.append("Richiesta %d: non comincia dove finisce la precedente." % request["n"])
        if request["note"] == "":
            found.append("Richiesta %d: manca la nota." % request["n"])
    return found


def output_name(model_path, n):
    name = model_path.replace("\\", "/").split("/")[-1]
    return "%s - %d.xlsx" % (re.sub(r"\.[^.]+$", "", name), n)


def main():
    # Tutto ciò che legge e scrive sta accanto allo script, da qualunque cartella sia lanciato.
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with open("config.json", encoding="utf-8") as file:
        config = json.load(file)
    parameters = {}
    if os.path.exists("parametri.json"):
        with open("parametri.json", encoding="utf-8") as file:
            parameters = json.load(file)
    result = {"ok": False, "messages": [], "files": []}
    computation = compute(config["positions"], config["requests"])
    if not computation["ok"]:
        result["messages"].append(problem_text(computation["problem"]))
        return result
    steps = computation["steps"]
    if not steps:
        result["messages"].append("Non c'è ancora nessuna richiesta nella configurazione.")
        return result
    asked = str(parameters.get("richiesta", "")).strip()
    n = int(asked) if asked.isdigit() else steps[-1]["request"]["n"]
    at = next((index for index, step in enumerate(steps) if step["request"]["n"] == n), None)
    if at is None:
        result["messages"].append("La richiesta %d non c'è: le richieste vanno da 1 a %d." % (n, len(steps)))
        return result
    step = steps[at]
    os.makedirs("uscita", exist_ok=True)
    with open(os.path.join("uscita", "quote.csv"), "w", encoding="utf-8", newline="") as file:
        rows = csv.writer(file, delimiter=";")
        rows.writerow(["richiesta", "posizione", "precedente", "attuale", "periodo"])
        for each in steps:
            for index, position in enumerate(config["positions"]):
                rows.writerow(
                    [each["request"]["n"], position["code"], each["previous"][index], each["current"][index], each["period"][index]]
                )
    result["files"].append("uscita/quote.csv")
    result["messages"].extend(warnings(config))
    result["messages"].append(
        "Richiesta %d: chiesto fin qui %s su %s; lo scarto dell'arrotondamento è %s."
        % (n, money(step["cumulative"]), money(computation["total"]), money(cents(step["rebuilt"] - step["cumulative"])))
    )
    if step["closing"]:
        result["messages"].append("Raggiunge il totale dell'ordine: tutte le posizioni sono al 100%.")
    if config.get("modelPath", "") == "":
        result["messages"].append("Nessun modulo indicato nella configurazione: ho calcolato le quote soltanto.")
        result["ok"] = True
        return result
    previous_to = steps[at - 1]["request"]["to"] if at > 0 else step["request"]["from"]
    writes, trouble = form_cells(config, step, previous_to)
    if writes is None:
        result["messages"].append(trouble)
        return result
    result["fill"] = {
        "model": config["modelPath"],
        "output": "uscita/" + output_name(config["modelPath"], n),
        "writes": writes,
    }
    result["computation"] = computation
    result["ok"] = True
    return result


if __name__ == "__main__":
    outcome = main()
    with open("esito.json", "w", encoding="utf-8") as file:
        json.dump(outcome, file, ensure_ascii=False)
    print("\n".join(outcome["messages"]))

"""Allineamento fra il tracker del cliente e il tracker interno, per uno sprint.

Legge config.json (sprint, periodo, tag, prefissi, gruppi di stati, tipi), le voci del tracker
del cliente (ingressi/voci.json) e i ticket del tracker interno (ingressi/ticket.json), che Octo
prepara con gli stessi lettori del Cruscotto. Una voce e un ticket sono collegati se la voce ha
fra i tag la chiave del ticket, altrimenti se il titolo del ticket nomina l'id della voce dopo un
prefisso. Mai per somiglianza.

Scrive: esito.json (per Octo), uscita/mancanti_<sprint>.csv (i ticket da importare a mano) e
uscita/allineamento.md (le liste).
"""
import json
import os
import re

NUMBER = re.compile(r"[0-9]+")


def sprint_key(name):
    last = re.split(r"[\\/]", name)[-1]
    return re.sub(r"\s+", " ", last.strip().lower())


def same_sprint(name, wanted):
    return name is not None and sprint_key(name) == sprint_key(wanted)


def referenced_ids(title, prefixes):
    """Gli id delle voci del cliente che un titolo nomina: [AZDO 123], [AZDO-123, 456]."""
    if not prefixes:
        return []
    pattern = re.compile(r"\[(?:%s)[\s:#-]+([^\]]*)\]?" % "|".join(prefixes), re.IGNORECASE)
    ids = []
    for found in pattern.finditer(title):
        for number in NUMBER.findall(found.group(1) or ""):
            if number not in ids:
                ids.append(number)
    return ids


def text(value):
    return value if isinstance(value, str) and value != "" else None


def ticket_of(entry):
    """Un ticket da ciò che la fonte ne ha scritto; None per ciò che non è un ticket."""
    record = entry.get("record") or {}
    key = text(record.get("key"))
    if key is None:
        return None
    sprints = record.get("sprints")
    return {
        "key": key,
        "title": entry.get("title", ""),
        "type": text(record.get("type")) or "",
        "status": text(record.get("status")) or "",
        "sprint": text(record.get("sprint")),
        "sprints": [sprint for sprint in sprints if isinstance(sprint, str)] if isinstance(sprints, list) else [],
        "assignee": text(record.get("assignee")),
    }


def in_scope(item, config):
    if not same_sprint(item.get("sprint"), config["sprint"]):
        return False
    if config["period"] != "" and item.get("period") != config["period"]:
        return False
    if not config["tags"]:
        return True
    own = [tag.lower() for tag in item.get("tags", [])]
    return any(tag.lower() in own for tag in config["tags"])


def align(items, tickets, config):
    """Ogni voce dello sprint finisce in una sola lista: con un ticket nello sprint, con un
    ticket altrove, senza ticket."""
    scoped = [item for item in items if in_scope(item, config)]
    by_key = {}
    for ticket in tickets:
        by_key[ticket["key"].upper()] = ticket
    citing = {}
    cited = {}
    for ticket in tickets:
        ids = referenced_ids(ticket["title"], config["referencePrefixes"])
        cited[ticket["key"]] = ids
        for item_id in ids:
            citing.setdefault(item_id, []).append(ticket)

    def group_of(state, side):
        for group in config["stateGroups"]:
            if any(name.lower() == state.lower() for name in group[side]):
                return group["name"]
        return None

    linked, needs_update, missing = [], [], []
    tied = set()
    for item in scoped:
        tagged = [by_key[tag.upper()] for tag in item.get("tags", []) if tag.upper() in by_key]
        found = tagged if tagged else citing.get(item["id"], [])
        if not found:
            missing.append(item)
            continue
        for ticket in found:
            tied.add(ticket["key"])
        in_sprint = [ticket for ticket in found if same_sprint(ticket["sprint"], config["sprint"])]
        main = in_sprint[0] if in_sprint else found[0]
        item_group = group_of(item["state"], "item")
        ticket_group = group_of(main["status"], "ticket")
        pair = {
            "item": item,
            "tickets": list(found),
            "via": "tag" if tagged else "title",
            "itemGroup": item_group,
            "ticketGroup": ticket_group,
            "coherent": None if item_group is None or ticket_group is None else item_group == ticket_group,
        }
        (linked if in_sprint else needs_update).append(pair)
    scoped_ids = {item["id"] for item in scoped}
    all_ids = {item["id"] for item in items}
    orphans, unreferenced = [], []
    for ticket in tickets:
        if not same_sprint(ticket["sprint"], config["sprint"]) or ticket["key"] in tied:
            continue
        ids = cited.get(ticket["key"], [])
        if not ids:
            unreferenced.append(ticket)
            continue
        outside = [item_id for item_id in ids if item_id not in scoped_ids]
        unknown = [item_id for item_id in outside if item_id not in all_ids]
        orphans.append(
            {
                "ticket": ticket,
                "ids": unknown if unknown else outside,
                "reason": "unknown" if unknown else "out_of_scope",
            }
        )
    return {
        "total": len(scoped),
        "linked": linked,
        "needsUpdate": needs_update,
        "missing": missing,
        "duplicates": [pair for pair in linked + needs_update if len(pair["tickets"]) > 1],
        "orphans": orphans,
        "unreferenced": unreferenced,
        "adds": len(linked) + len(needs_update) + len(missing) == len(scoped),
    }


CSV_HEADER = ["Summary", "Issue Type", "Priority", "Assignee", "Description", "Sprint"]
ENTITIES = {"&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'"}


def plain_text(value):
    """Una descrizione come testo: il markup del tracker tolto, le righe tenute."""
    value = re.sub(r"<\s*(?:br|/p|/div|/li)\s*/?>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"&(?:nbsp|amp|lt|gt|quot|#39);", lambda found: ENTITIES.get(found.group(0), found.group(0)), value)
    value = re.sub(r"[ \t]+\n", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def csv_cell(value):
    if re.search(r'[",\n\r]', value):
        return '"%s"' % value.replace('"', '""')
    return value


def missing_csv(missing, config):
    """Le voci senza ticket come file che il tracker interno importa: il titolo porta l'id della
    voce, così il confronto successivo le collega. La priorità resta vuota: la decide il team."""
    prefix = config["referencePrefixes"][0] if config["referencePrefixes"] else None

    def type_of(kind):
        for pair in config["typeMap"]:
            if pair["item"].lower() == kind.lower():
                return pair["ticket"]
        return kind

    rows = [CSV_HEADER]
    for item in missing:
        title = "[%s %s] %s" % (prefix, item["id"], item["title"]) if prefix else item["title"]
        rows.append(
            [title, type_of(item["type"]), "", item.get("assignee") or "", plain_text(item["description"]), config["sprint"]]
        )
    return "\r\n".join(",".join(csv_cell(cell) for cell in row) for row in rows) + "\r\n"


def file_slug(name):
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))


def report(config, found, exported_at, tickets):
    lines = ["# Allineamento dello sprint «%s»" % config["sprint"], ""]
    lines.append(
        "Tracker del cliente letto il %s; %d ticket letti dal tracker interno."
        % (exported_at or "(data non scritta)", tickets)
    )
    lines.append("")
    lines.append(
        "Voci nello sprint: %d. Con ticket nello sprint: %d. Con ticket altrove: %d. Senza ticket: %d. %s"
        % (
            found["total"],
            len(found["linked"]),
            len(found["needsUpdate"]),
            len(found["missing"]),
            "I conti tornano." if found["adds"] else "ATTENZIONE: le tre liste non sommano al totale.",
        )
    )

    def pairs(title, entries):
        lines.extend(["", "## %s (%d)" % (title, len(entries)), ""])
        for pair in entries:
            keys = ", ".join(ticket["key"] for ticket in pair["tickets"])
            state = ""
            if pair["coherent"] is False:
                state = " — stati diversi: %s / %s" % (pair["itemGroup"], pair["ticketGroup"])
            lines.append("- %s %s → %s%s" % (pair["item"]["id"], pair["item"]["title"], keys, state))

    pairs("Con ticket nello sprint", found["linked"])
    pairs("Con ticket in un altro sprint o in nessuno", found["needsUpdate"])
    lines.extend(["", "## Senza ticket (%d)" % len(found["missing"]), ""])
    for item in found["missing"]:
        lines.append("- %s %s" % (item["id"], item["title"]))
    lines.extend(["", "## Ticket dello sprint senza riferimento (%d)" % len(found["unreferenced"]), ""])
    for ticket in found["unreferenced"]:
        lines.append("- %s %s" % (ticket["key"], ticket["title"]))
    lines.extend(["", "## Ticket che nominano una voce che non c'è o è fuori perimetro (%d)" % len(found["orphans"]), ""])
    for orphan in found["orphans"]:
        why = "non esiste" if orphan["reason"] == "unknown" else "fuori dallo sprint o dai tag"
        lines.append("- %s nomina %s: %s" % (orphan["ticket"]["key"], ", ".join(orphan["ids"]), why))
    return "\n".join(lines) + "\n"


def main():
    # Tutto ciò che legge e scrive sta accanto allo script, da qualunque cartella sia lanciato.
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with open("config.json", encoding="utf-8") as file:
        config = json.load(file)
    parameters = {}
    if os.path.exists("parametri.json"):
        with open("parametri.json", encoding="utf-8") as file:
            parameters = json.load(file)
    asked = str(parameters.get("sprint", "")).strip()
    if asked != "":
        config["sprint"] = asked
    result = {"ok": False, "messages": [], "files": []}
    if config["sprint"] == "":
        result["messages"].append("Non è scritto quale sprint confrontare: indicalo qui o nella configurazione.")
        return result
    with open(os.path.join("ingressi", "voci.json"), encoding="utf-8") as file:
        exported = json.load(file)
    with open(os.path.join("ingressi", "ticket.json"), encoding="utf-8") as file:
        tickets = [ticket for ticket in (ticket_of(entry) for entry in json.load(file)) if ticket is not None]
    if not tickets:
        result["messages"].append("Non ho trovato ticket del tracker interno: la fonte Jira li ha letti?")
        return result
    found = align(exported["items"], tickets, config)
    os.makedirs("uscita", exist_ok=True)
    name = "mancanti_%s.csv" % file_slug(config["sprint"])
    with open(os.path.join("uscita", name), "w", encoding="utf-8", newline="") as file:
        file.write(missing_csv(found["missing"], config))
    with open(os.path.join("uscita", "allineamento.md"), "w", encoding="utf-8", newline="") as file:
        file.write(report(config, found, exported.get("exportedAt"), len(tickets)))
    result["files"] = ["uscita/" + name, "uscita/allineamento.md"]
    result["messages"].append(
        "Sprint «%s»: %d voci, %d con ticket nello sprint, %d con ticket altrove, %d senza ticket."
        % (config["sprint"], found["total"], len(found["linked"]), len(found["needsUpdate"]), len(found["missing"]))
    )
    if not found["adds"]:
        result["messages"].append("ATTENZIONE: le tre liste non sommano al totale.")
    result["alignment"] = found
    result["ok"] = True
    return result


if __name__ == "__main__":
    outcome = main()
    with open("esito.json", "w", encoding="utf-8") as file:
        json.dump(outcome, file, ensure_ascii=False)
    print("\n".join(outcome["messages"]))

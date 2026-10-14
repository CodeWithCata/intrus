/**
 * Number of words per category, so the category tiles can show "N cuvinte" without loading the
 * lists. Checked against the real lists in tests/unit/wordlists.test.ts - update both when a list
 * changes.
 */
export const WORD_COUNTS: Record<string, number> = {
    "Animale": 55,
    "Mâncare": 59,
    "Locuri": 55,
    "Meserii": 54,
    "Obiecte": 56,
    "Sport": 54,
    "Transport": 52,
    "Haine": 54,
    "Natură": 56,
    "Orașe și țări": 57,
    "Casă": 54,
    "Muzică": 54,
    "Sărbători": 52,
    "La școală": 53,
    "Crăciun": 30,
    "București": 30,
    "Anii '90": 30,
    "Eurovision": 30,
    "Politicieni": 26,
    "Personalități": 30,
    "Filme și desene": 30,
    "Fructe și legume": 30,
    "Tehnologie": 30,
    "Corpul uman": 30,
    "Basme": 28,
    "Instrumente": 28,
    "Mâncare tradițională": 97,
    "Locuri din România": 92,
    "Proverbe și expresii": 90,
    "Filme și seriale românești": 85,
    "Muzică românească": 92,
    "Paște și Halloween": 80,
    "Tradiții și datini": 84,
    "Vacanță": 88,
    "Petrecere": 87
};

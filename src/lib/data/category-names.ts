/**
 * Category names per language. A category's Romanian name is its identity (it is what `state.cats` stores and what the word files are
 * keyed by), so another language only changes how it is shown. A language without an entry shows the Romanian name.
 */
export const CATEGORY_NAMES: Record<string, Record<string, string>> = {
    en: {
        "Animale": "Animals",
        "Mâncare": "Food",
        "Locuri": "Places",
        "Meserii": "Jobs",
        "Obiecte": "Objects",
        "Sport": "Sports",
        "Transport": "Transport",
        "Haine": "Clothes",
        "Natură": "Nature",
        "Orașe și țări": "Cities & countries",
        "Casă": "Home",
        "Muzică": "Music",
        "Sărbători": "Holidays",
        "La școală": "At school",
        "Crăciun": "Christmas",
        "București": "Bucharest",
        "Anii '90": "The '90s",
        "Eurovision": "Eurovision",
        "Politicieni": "Politicians",
        "Personalități": "Celebrities",
        "Filme și desene": "Films & cartoons",
        "Fructe și legume": "Fruit & veg",
        "Tehnologie": "Technology",
        "Corpul uman": "Human body",
        "Basme": "Fairy tales",
        "Instrumente": "Instruments",
        "Mâncare tradițională": "Traditional food",
        "Locuri din România": "Places in Romania",
        "Proverbe și expresii": "Proverbs & sayings",
        "Filme și seriale românești": "Romanian films & series",
        "Muzică românească": "Romanian music",
        "Paște și Halloween": "Easter & Halloween",
        "Tradiții și datini": "Traditions",
        "Vacanță": "Holiday",
        "Petrecere": "Party"
    }
};

/** The name to show for a category in the given language. */
export const catName = (cat: string, lang: string): string => CATEGORY_NAMES[lang]?.[cat] ?? cat;

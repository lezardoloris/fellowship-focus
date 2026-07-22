/* Block-page personas.
   Rule: real people get REAL, attributable quotes only — we never put invented
   words in a living or historical person's mouth. Fictional characters and
   original archetypes speak freely. */

const PERSONAS = {
  gandalf: {
    name: "Gandalf",
    title: "the Grey",
    kind: "fiction",
    lines: [
      "You cannot pass. Not while there is work yet undone.",
      "All we have to decide is what to do with the time that is given us. Not this. Not now.",
      "A wizard is never late — nor is he early. He arrives precisely when he means to. Go back.",
      "Even the smallest person can change the course of the future. Begin with the next hour.",
    ],
  },
  aragorn: {
    name: "Aragorn",
    title: "son of Arathorn",
    kind: "fiction",
    lines: [
      "A day may come when you scroll. But it is not this day.",
      "I do not fear the work. I fear leaving it unfinished.",
      "Hold your ground. The task is still there when the noise passes.",
      "You carry more than you know. Put it toward something.",
    ],
  },
  samwise: {
    name: "Samwise",
    title: "the loyal",
    kind: "fiction",
    lines: [
      "There's some good in this world, and it's worth working for.",
      "I can't carry the task for you — but I can carry you back to it.",
      "Small steps, one after another. That's how the road gets walked.",
      "Don't you leave it half done. Not after coming this far.",
    ],
  },
  sergeant: {
    name: "The Sergeant",
    title: "no excuses",
    kind: "archetype",
    lines: [
      "You did not open that tab by accident. You opened it to avoid something. Go do that thing.",
      "Discipline is choosing what you want most over what you want now. Choose again.",
      "Nobody is coming to make you focus. That is the whole job.",
      "The scroll gives you nothing and takes the hour. Close it.",
      "Comfort is the enemy of the work. Get back in.",
    ],
  },
  aurelius: {
    name: "Marcus Aurelius",
    title: "Meditations",
    kind: "real",
    lines: [
      "You have power over your mind — not outside events. Realize this, and you will find strength.",
      "Confine yourself to the present.",
      "Never let the future disturb you. You will meet it with the same weapons of reason which today arm you against the present.",
      "The impediment to action advances action. What stands in the way becomes the way.",
    ],
  },
  einstein: {
    name: "Albert Einstein",
    title: "physicist",
    kind: "real",
    lines: [
      "It's not that I'm so smart, it's just that I stay with problems longer.",
      "A calm and modest life brings more happiness than the pursuit of success combined with constant restlessness.",
      "The value of a man should be seen in what he gives and not in what he is able to receive.",
      "Life is like riding a bicycle. To keep your balance you must keep moving.",
    ],
  },
  musk: {
    name: "Elon Musk",
    title: "engineer",
    kind: "real",
    lines: [
      "Work like hell. If other people are putting in 40-hour work weeks and you're putting in 100-hour work weeks, you will achieve in four months what it takes them a year.",
      "Persistence is very important. You should not give up unless you are forced to give up.",
      "If you get up in the morning and think the future is going to be better, it is a bright day.",
      "It's OK to have your eggs in one basket as long as you control what happens to that basket.",
    ],
  },
};

const PERSONA_ORDER = [
  "gandalf",
  "aragorn",
  "samwise",
  "sergeant",
  "aurelius",
  "einstein",
  "musk",
];

/** Pick a persona; "random" (default) rotates so the page never goes stale. */
function pickPersona(id) {
  if (id && id !== "random" && PERSONAS[id]) return { id, ...PERSONAS[id] };
  const key = PERSONA_ORDER[Math.floor(Math.random() * PERSONA_ORDER.length)];
  return { id: key, ...PERSONAS[key] };
}

function pickLine(persona) {
  return persona.lines[Math.floor(Math.random() * persona.lines.length)];
}

if (typeof module !== "undefined") {
  module.exports = { PERSONAS, PERSONA_ORDER, pickPersona, pickLine };
}

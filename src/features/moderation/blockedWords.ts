// src/features/moderation/blockedWords.ts
// Built-in blocked-word lists for educational chat moderation.
// Words are lower-cased and matched on token boundaries.

import type { ModerationCategory } from "./types";

export const BUILT_IN_BLOCKED_WORDS: Record<ModerationCategory, string[]> = {
  profanity: [
    "damn", "hell", "crap", "shit", "fuck", "bitch", "bastard", "asshole",
    "dick", "cock", "pussy", "bullshit", "motherfucker", "fucking", "fucked",
    "shitty", "crap", "ass", "arse", "bloody", "bollocks", "wanker", "twat",
    "slut", "whore", "ho", "retard", "retarded", "moron", "idiot", "dumbass",
    "jackass", "piss", "pissed", "screw you", "screw off", "suck it", "stfu",
    "wtf", "omfg", "gtfo", "kys", "fk", "fu", "fck", "sh1t", "b1tch", "a$$",
  ],

  harassment: [
    "shutup", "shut up", "loser", "nobody likes you", "kill yourself",
    "ugly", "stupid idiot", "worthless", "fat", "fatty", "tubby", "chunky",
    "four eyes", "brace face", "lame", "weirdo", "freak", "creep", "psycho",
    "mental", "crazy", "dumb", "slow", "special ed", "sped", "r*tard",
    "you're trash", "you're garbage", "no one cares", "go away", "leave me alone",
    "get lost", "get a life", "virgin", "simp", "incel", "nerd", "geek",
    "teacher's pet", "suck up", "kiss ass", "brown nose", "loner", "outcast",
    "reject", "failure", "disappointment", "mistake", "accident", "unwanted",
    "kill yourself", "kys", "drink bleach", "rope", "jump off", "hang yourself",
  ],

  threat: [
    "i'll hurt you", "i will hurt you", "watch your back", "you're dead",
    "meet me after school", "i'm coming for you", "you're finished",
    "i'll kill you", "i will kill you", "i'm gonna beat you", "i'll stab you",
    "i'll shoot you", "i have a gun", "i have a knife", "bring a weapon",
    "fight me", "let's fight", "after school fight", "jump you", "gang up",
    "ambush", "corner you", "trap you", "lock you in", "tie you up",
    "burn you", "set you on fire", "push you down", "throw you", "hit you",
    "punch you", "slap you", "choke you", "strangle you", "drown you",
    "run you over", "run over", "car accident", "poison you", "drug you",
    "kidnap", "abduct", "hostage", "ransom", "bomb", "explosive", "weapon",
    "shank", "shiv", "blade", "firearm", "pistol", "rifle", "ammo",
  ],

  hate: [
    "nigger", "nigga", "negro", "coon", "monkey", "ape", "chink", "gook",
    "spic", "wetback", "beaner", "kike", "jewboy", "heeb", "raghead", "towelhead",
    "camel jockey", "sand nigger", "terrorist", "osama", "paki", "curry muncher",
    "cholo", "gringo", "cracker", "honky", "white trash", "redneck", "hillbilly",
    "faggot", "fag", "dyke", "lesbo", "tranny", "shemale", "homo", "queer",
    "gaylord", "gaywad", "cocksucker", "pillow biter", "batty boy", "fruit",
    "retard", "spaz", "cripple", "midget", "dwarf", "mongoloid", "downie",
    "autistic freak", "autist", "schizo", "bipolar freak", "psycho", "nutcase",
    "white power", "black power", "heil hitler", "sieg heil", "nazi", "neo nazi",
    "kkk", "klan", "supremacist", "inferior race", "master race", "ethnic cleansing",
    "go back to your country", "speak english", "illegal alien", "anchor baby",
    "terrorist", "jihad", "infidel", "kafir", "unclean", "subhuman", "vermin",
  ],

  "self-harm": [
    "kill myself", "want to die", "end it all", "self harm", "self-harm",
    "cutting", "cutter", "cut myself", "slash my wrists", "wrist cutting",
    "blood letting", "self injury", "self-injury", "burn myself", "burning",
    "overdose", "od on pills", "take too many pills", "suicide", "suicidal",
    "suicide pact", "hang myself", "hanging", "jump off bridge", "jump off building",
    "step in front of traffic", "drive into a wall", "crash my car", "drown myself",
    "starve myself", "stop eating", "anorexic", "anorexia", "bulimia", "bulimic",
    "purge", "throwing up on purpose", "making myself sick", "thinspo", "thinspiration",
    "pro ana", "pro mia", "bonespo", "deathspo", "suicide note", "goodbye letter",
    "final message", "won't be here tomorrow", "not worth living", "better off dead",
    "everyone would be better off", "no reason to live", "can't go on", "give up",
    "end my pain", "make the pain stop", "eternal sleep", "permanent solution",
    "sleep forever", "never wake up", "cease to exist", "disappear", "vanish",
    "i'm done", "i'm over", "can't take it anymore", "too much to handle",
    "breaking point", "edge", "on the ledge", "final straw", "last resort",
  ],

  custom: [],
};

/** Flattened list with category attached, used by the detection engine. */
export function getAllBlockedWordEntries(customWords: string[] = []) {
  const entries: { word: string; category: ModerationCategory }[] = [];
  for (const [category, words] of Object.entries(BUILT_IN_BLOCKED_WORDS) as [
    ModerationCategory,
    string[],
  ][]) {
    for (const word of words) entries.push({ word: word.toLowerCase(), category });
  }
  for (const word of customWords) {
    entries.push({ word: word.toLowerCase(), category: "custom" });
  }
  return entries;
}

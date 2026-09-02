# Ability rotation v2 — session handoff prompt

**Status:** raised 2026-09-02, spun out of the multi-mob-parry-cooldown
conversation but deliberately parked as its own separate project (see
`docs/superpowers/BACKLOG.md`'s "Ability rotation v2" entry under Combat
pass ideas, and `docs/superpowers/specs/2026-09-02-multimob-parry-
cooldown-design.md`'s Purpose section for the split). Not started. This
file is the paste-in opening prompt for whoever picks it up next,
written from Timothy's own words rather than needing him to re-explain
it cold.

Paste this in as the opening message of that session:

> Pick up the "Ability rotation v2" item from `docs/superpowers/
> BACKLOG.md` (Combat pass ideas section, raised 2026-09-02). Read that
> entry's full context first. Invoke `superpowers:brainstorming` before
> touching any code or design doc - this is a real redesign of the 4
> damage abilities, not a bounded tweak.
>
> Today's roster (`js/systems/abilities.js`): Stab, Chop, Slash, Sweep,
> unlocking at levels 2/4/6/8, each currently just a bigger single-target
> (or, for Sweep, flat-AOE) number than the last, with Stab/Slash also
> carrying the existing press-in-the-sweet-spot timing meter.
>
> My own vision, paraphrased from when I raised this: all 4 become
> instant (no separate timing-meter step) and take on distinct rotation
> roles instead of just bigger numbers:
> - One strong single-target hit.
> - One that always hits its target plus one random adjacent enemy
>   (still fine to use one-on-one).
> - One that carries the timing-game payoff, but re-triggered by
>   pressing that *same* ability again at the right moment - not a
>   separate key/button like today's meter - and landing it buffs the
>   other abilities for a duration.
> - One weak all-enemies AOE whose real point isn't its own damage - it's
>   supposed to widen what the other three abilities can hit (more
>   targets, more damage, or some other effect) for a while after using
>   it.
>
> Super Scream stays as-is - not part of this rework.
>
> Also want to think about slowing combat down a little but making hits
> feel bigger and chunkier - possibly one big damage/AOE payoff move
> buildable by doing the rotation right, not just steady DPS. (There's a
> separate, already-open "slower combat / reconsider the timing-minigame
> layer" backlog thread too - read that one alongside this, they're
> related but not the same ask.)
>
> Last piece: I want new names for Stab/Chop/Slash specifically - big,
> damaging, scary-sounding, but explicitly *not* sounding like they were
> lifted straight from another game (my own example: nothing that reads
> as a WoW warrior ability). I already generated a candidate word list of
> my own to remix/combine from (compound/prefix style - things like
> Sundering, Cleaving, Rending, Impaling, Perforating, Goring, Flaying,
> Lacerating) - work from picking/refining that list, don't invent a
> wholly new one from scratch. This is ability/UI naming, not
> story/lore/dialogue, so it's fine for engineering support the same way
> any other UI copy is - my "I write the narrative myself" rule
> (`docs/superpowers/BACKLOG.md`'s "The game needs an actual story"
> section) is about plot/lore/dialogue, not this.
>
> Nothing here is designed yet - which of the 4 slots maps to which new
> role, the AOE-widen mechanic's actual numbers, how the re-timed buff
> trigger feels without a dedicated key, and the final ability names are
> all open. Ask me the questions that matter one at a time rather than
> guessing.

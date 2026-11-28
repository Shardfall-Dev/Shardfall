-- Server Combat v1: a character can die online and walk as a ghost until it is restored at a shrine.
-- Health, mana, skills and stats already have columns; the ghost flag is the only new state.
alter table game.characters add column if not exists ghost boolean not null default false;

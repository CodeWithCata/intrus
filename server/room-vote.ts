/** Voting: the host opens a vote, dealt-in players point at a suspect, votes stay hidden until everyone voted or the host reveals.  (see room-logic.ts) */
import { RoomError, markHostAction, requireHost } from "./room-core.ts";
import { type Room } from "./types.ts";

/* ---------------- voting ----------------
 * The host opens a vote; each dealt-in player points at a suspect (changeable until the reveal).
 * Nobody sees who voted for whom until everyone connected has voted, or the host shows the votes.
 * The tally is information for the group: the host still resolves the outcome and scores. */
export function voteOf(room: Room) {
  return room.phase === "round" && room.current ? room.current.vote : null;
}

export function openVote(room: Room, hostId: string): Room {
  requireHost(room, hostId);
  if (room.phase !== "round" || !room.current) throw new RoomError("bad-phase", "No round in progress.");
  if (!room.current.vote) room.current.vote = { picks: {}, revealed: false };
  markHostAction(room);
  return room;
}

export function castVote(room: Room, voterId: string, suspectId: string): Room {
  const v = voteOf(room);
  if (!v || !room.current) throw new RoomError("no-vote", "There is no vote open.");
  if (v.revealed) throw new RoomError("vote-closed", "The votes are already in.");
  const ids = room.current.playerIds;
  if (!ids.includes(voterId)) throw new RoomError("not-in-round", "You're not in this round.");
  if (!ids.includes(suspectId) || suspectId === voterId) throw new RoomError("bad-suspect", "Pick another player.");
  v.picks[voterId] = suspectId;
  revealVoteIfComplete(room);
  return room;
}

export function revealVote(room: Room, hostId: string): Room {
  requireHost(room, hostId);
  const v = voteOf(room);
  if (!v) throw new RoomError("no-vote", "There is no vote open.");
  v.revealed = true;
  markHostAction(room);
  return room;
}

/** Reveals once every connected, dealt-in player has voted. Never reveals an empty vote on its own. */
export function revealVoteIfComplete(room: Room): void {
  const v = voteOf(room);
  if (!v || v.revealed || !room.current) return;
  if (Object.keys(v.picks).length === 0) return;
  const waiting = room.current.playerIds.filter((id) => {
    const p = room.players.find((x) => x.id === id);
    return p && p.connected && !(id in v.picks);
  });
  if (!waiting.length) v.revealed = true;
}

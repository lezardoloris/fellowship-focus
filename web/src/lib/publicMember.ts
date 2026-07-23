/** Strip secrets from member rows before public API responses. */

export type PublicMember = {
  id: string;
  fellowship_id: string;
  name: string;
  total_xp: number;
  streak: number;
  last_quest_date: string | null;
  created_at: string;
};

export function toPublicMember(m: {
  id: string;
  fellowship_id: string;
  name: string;
  total_xp: number;
  streak: number;
  last_quest_date: string | null;
  created_at: string;
  token?: string;
}): PublicMember {
  return {
    id: m.id,
    fellowship_id: m.fellowship_id,
    name: m.name,
    total_xp: m.total_xp,
    streak: m.streak,
    last_quest_date: m.last_quest_date,
    created_at: m.created_at,
  };
}

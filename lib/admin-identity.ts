type Account = { user_id: string; username: string; player_id: number } | null;

// Pin privileges to the existing account, not a display name or mutable metadata.
export function isLeagueAdmin(account: Account): boolean {
  return account?.user_id === "3d8f7c0d-82f9-458c-af0a-a296d66948a6"
    && account.username === "tinturi" && Number(account.player_id) === 1;
}

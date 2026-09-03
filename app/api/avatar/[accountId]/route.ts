import { NextResponse } from "next/server";

export const revalidate = 21600;

type OpenDotaProfile = {
  profile?: {
    avatarfull?: string | null;
    avatarmedium?: string | null;
    avatar?: string | null;
  };
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;
  const numericAccountId = Number(accountId);

  if (!Number.isFinite(numericAccountId)) {
    return NextResponse.json({ avatar: null }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.opendota.com/api/players/${numericAccountId}`,
      {
        next: { revalidate: 21600 },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { avatar: null },
        { headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
      );
    }

    const data = (await response.json()) as OpenDotaProfile;
    const avatar =
      data.profile?.avatarfull ??
      data.profile?.avatarmedium ??
      data.profile?.avatar ??
      null;

    return NextResponse.json(
      { avatar },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600" } },
    );
  } catch {
    return NextResponse.json(
      { avatar: null },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
    );
  }
}

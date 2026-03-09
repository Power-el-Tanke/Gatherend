import { AuthProvider, Profile } from "@prisma/client";
import { db } from "@/lib/db";

interface IdentityLookupInput {
  providerUserId: string;
}

export async function getIdentity(input: IdentityLookupInput) {
  return db.authIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: AuthProvider.BETTER_AUTH,
        providerUserId: input.providerUserId,
      },
    },
  });
}

export async function getProfileByIdentity(
  input: IdentityLookupInput,
): Promise<Profile | null> {
  const identity = await getIdentity(input);
  if (!identity) return null;

  return db.profile.findUnique({
    where: { id: identity.profileId },
  });
}

interface LinkIdentityInput {
  providerUserId: string;
  profileId: string;
}

export async function linkIdentityToProfile(input: LinkIdentityInput) {
  return db.authIdentity.upsert({
    where: {
      provider_providerUserId: {
        provider: AuthProvider.BETTER_AUTH,
        providerUserId: input.providerUserId,
      },
    },
    update: {
      profileId: input.profileId,
    },
    create: {
      provider: AuthProvider.BETTER_AUTH,
      providerUserId: input.providerUserId,
      profileId: input.profileId,
    },
  });
}


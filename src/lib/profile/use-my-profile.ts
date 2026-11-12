import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/api/workspaces.functions";
import { profileQueryKey } from "./profile";

export function useMyProfile(userId: string | undefined) {
  const fetchProfile = useServerFn(getMyProfile);
  return useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: () => fetchProfile(),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

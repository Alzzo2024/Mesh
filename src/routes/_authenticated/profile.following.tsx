import { createFileRoute } from "@tanstack/react-router";
import { FollowList } from "./profile.followers";

export const Route = createFileRoute("/_authenticated/profile/following")({
  head: () => ({ meta: [{ title: "Mesh — A seguir" }] }),
  component: () => <FollowList kind="following" />,
});

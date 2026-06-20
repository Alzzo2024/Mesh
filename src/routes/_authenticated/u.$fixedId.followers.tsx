import { createFileRoute } from "@tanstack/react-router";
import { FollowList } from "./profile.followers";

export const Route = createFileRoute("/_authenticated/u/$fixedId/followers")({
  head: ({ params }) => ({ meta: [{ title: `Mesh — #${params.fixedId} seguidores` }] }),
  component: () => {
    const { fixedId } = Route.useParams();
    return <FollowList kind="followers" fixedId={fixedId} />;
  },
});
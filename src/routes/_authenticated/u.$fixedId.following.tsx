import { createFileRoute } from "@tanstack/react-router";
import { FollowList } from "./profile.followers";

export const Route = createFileRoute("/_authenticated/u/$fixedId/following")({
  head: ({ params }) => ({ meta: [{ title: `Mesh — @${params.fixedId} a seguir` }] }),
  component: () => {
    const { fixedId } = Route.useParams();
    return <FollowList kind="following" fixedId={fixedId} />;
  },
});
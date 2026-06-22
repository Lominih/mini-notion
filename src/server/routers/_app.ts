import { router } from '@/server/trpc';
import { pageRouter } from './page';
import { tagRouter } from './tag';
import { templateRouter } from './template';
import { commentRouter } from './comment';
import { userRouter } from './user';
import { workspaceRouter } from './workspace';
import { memberRouter } from './member';
import { ioRouter } from './io';

export const appRouter = router({
  page: pageRouter,
  tag: tagRouter,
  template: templateRouter,
  comment: commentRouter,
  user: userRouter,
  workspace: workspaceRouter,
  member: memberRouter,
  io: ioRouter,
});

export type AppRouter = typeof appRouter;

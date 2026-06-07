// Per-file setup for integration tests. Runs after globalSetup has pushed the
// schema. Truncates all tables before each test so every test starts from a
// clean slate.
//
// This file is only loaded for tests in src/tests/integration/.

import { afterAll, beforeEach } from 'vitest';
import path from 'node:path';
import { rm, mkdir } from 'node:fs/promises';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { tempUploadDir } from '../../services/fileStorage.js';

beforeEach(async () => {
  // FK-safe order: children first.
  await prisma.taskAIChangeBatch.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.file.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.document.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.providerConfig.deleteMany();
  await prisma.quickPrompt.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // Clear the file storage root between tests so we don't accumulate uploaded
  // bytes across runs and so cross-test orphans don't pollute the next test's
  // assertions. Recreate the temp dir afterwards so multer has somewhere to
  // write.
  const root = path.resolve(config.fileStorageRoot);
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  await mkdir(tempUploadDir(), { recursive: true });
});

afterAll(async () => {
  await prisma.$disconnect();
});

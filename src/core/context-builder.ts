// Context Builder (pure): turns a question into prompt content and a
// readable-file allowlist. Item Context, About me and language land in #4,
// Quick Actions in #7, Paper Context modes and the Selection picture in #8.
import { notImplemented } from './not-implemented';
import type { BuiltQuestion, QuestionInput } from './types';

export function buildQuestion(input: QuestionInput): BuiltQuestion {
  void input;
  return notImplemented('buildQuestion', '#4');
}

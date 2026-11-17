import { resetRequestSchema, signupRequestSchema } from '@app/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import type { Config } from '../config';
import type { Database } from '../db/schema';
import { consumeInvitation, InvitationError, isInvitationUsable } from '../users/invitations';
import { consumePasswordReset, getPasswordReset, PasswordResetError } from '../users/passwords';
import { createUser, UserInputError } from '../users/users';
import { parseBody, perMinute, sendSiteError, toSiteUser } from './http';
import { negotiateLocale, startSession } from './session';

const SIGNUP_MAX_PER_MINUTE = 10;

type TokenParams = { Params: { token: string } };

export async function publicRoutes(
  app: FastifyInstance,
  opts: { db: Kysely<Database>; config: Config },
) {
  const { db, config } = opts;
  const limited = perMinute(SIGNUP_MAX_PER_MINUTE);

  const inputError = (reply: FastifyReply, error: unknown) => {
    if (error instanceof UserInputError) return sendSiteError(reply, 400, error.code);
    throw error;
  };
  const browserLocale = (request: FastifyRequest) =>
    negotiateLocale(request.headers['accept-language']);

  app.get<TokenParams>('/invitations/:token', async (request, reply) => {
    if (!(await isInvitationUsable(db, request.params.token))) {
      return sendSiteError(reply, 410, 'invitation_invalid');
    }
    return reply.status(204).send();
  });

  app.post<TokenParams>('/invitations/:token', limited, async (request, reply) => {
    const body = parseBody(signupRequestSchema, request.body);
    try {
      const user = await consumeInvitation(db, request.params.token, {
        ...body,
        locale: browserLocale(request),
      });
      startSession(request, user.id, user.sessionVersion);
      return reply.status(201).send({ user: toSiteUser(user) });
    } catch (error) {
      if (error instanceof InvitationError) return sendSiteError(reply, 410, 'invitation_invalid');
      return inputError(reply, error);
    }
  });

  if (config.openSignup) {
    app.post('/signup', limited, async (request, reply) => {
      const body = parseBody(signupRequestSchema, request.body);
      try {
        const user = await createUser(db, {
          ...body,
          isAdmin: false,
          locale: browserLocale(request),
        });
        startSession(request, user.id, user.sessionVersion);
        return reply.status(201).send({ user: toSiteUser(user) });
      } catch (error) {
        return inputError(reply, error);
      }
    });
  }

  app.get<TokenParams>('/password-resets/:token', async (request, reply) => {
    const reset = await getPasswordReset(db, request.params.token);
    if (!reset) return sendSiteError(reply, 410, 'reset_invalid');
    return reset;
  });

  app.post<TokenParams>('/password-resets/:token', limited, async (request, reply) => {
    const body = parseBody(resetRequestSchema, request.body);
    try {
      const { user, sessionVersion } = await consumePasswordReset(
        db,
        request.params.token,
        body.password,
      );
      startSession(request, user.id, sessionVersion);
      return { user: toSiteUser(user) };
    } catch (error) {
      if (error instanceof PasswordResetError) return sendSiteError(reply, 410, 'reset_invalid');
      return inputError(reply, error);
    }
  });
}

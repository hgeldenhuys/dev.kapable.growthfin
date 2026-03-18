/**
 * Lead Notes Routes
 * REST endpoints for lead notes management
 */

import { Elysia, t } from 'elysia';
import { leadNotes, users } from '@agios/db';
import { eq, and, desc, isNull } from 'drizzle-orm';

export const leadNotesRoutes = new Elysia({ prefix: '/leads' })
  // GET /api/v1/crm/leads/:id/notes?workspaceId=xxx
  .get(
    '/:id/notes',
    async ({ db, params, query }) => {
      const notes = await db
        .select({
          id: leadNotes.id,
          content: leadNotes.content,
          contentHtml: leadNotes.contentHtml,
          isPrivate: leadNotes.isPrivate,
          createdAt: leadNotes.createdAt,
          updatedAt: leadNotes.updatedAt,
          mentionedUserIds: leadNotes.mentionedUserIds,
          createdBy: leadNotes.createdBy,
          userName: users.name,
          userImage: users.image,
        })
        .from(leadNotes)
        .leftJoin(users, eq(leadNotes.createdBy, users.id))
        .where(
          and(
            eq(leadNotes.workspaceId, query.workspaceId),
            eq(leadNotes.leadId, params.id),
            isNull(leadNotes.deletedAt)
          )
        )
        .orderBy(desc(leadNotes.createdAt));

      const transformedNotes = notes.map(note => ({
        id: note.id,
        content: note.content,
        content_html: note.contentHtml ?? undefined,
        is_private: note.isPrivate,
        created_at: note.createdAt?.toISOString() ?? new Date().toISOString(),
        updated_at: note.updatedAt?.toISOString() ?? undefined,
        created_by: {
          id: note.createdBy,
          name: note.userName ?? 'Unknown User',
          avatar: note.userImage ?? undefined,
        },
        mentioned_user_ids: note.mentionedUserIds ?? undefined,
      }));

      return { notes: transformedNotes };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Lead Notes'],
        summary: 'Get all notes for a lead',
      },
    }
  )
  // POST /api/v1/crm/leads/:id/notes?workspaceId=xxx
  .post(
    '/:id/notes',
    async ({ db, params, query, body }) => {
      const [newNote] = await db
        .insert(leadNotes)
        .values({
          workspaceId: query.workspaceId,
          leadId: params.id,
          content: body.content,
          contentHtml: body.content_html,
          isPrivate: body.is_private,
          mentionedUserIds: body.mentioned_user_ids,
          createdBy: body.created_by,
        })
        .returning();

      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          image: users.image,
        })
        .from(users)
        .where(eq(users.id, newNote.createdBy))
        .limit(1);

      return {
        id: newNote.id,
        content: newNote.content,
        content_html: newNote.contentHtml ?? undefined,
        is_private: newNote.isPrivate,
        created_at: newNote.createdAt?.toISOString() ?? new Date().toISOString(),
        updated_at: newNote.updatedAt?.toISOString() ?? undefined,
        created_by: {
          id: user?.id ?? newNote.createdBy,
          name: user?.name ?? 'Unknown User',
          avatar: user?.image ?? undefined,
        },
        mentioned_user_ids: newNote.mentionedUserIds ?? undefined,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        content: t.String(),
        is_private: t.Boolean(),
        mentioned_user_ids: t.Array(t.String()),
        created_by: t.String(),
        content_html: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Lead Notes'],
        summary: 'Create a new note',
      },
    }
  )
  // PATCH /api/v1/crm/leads/notes/:noteId?workspaceId=xxx
  .patch(
    '/notes/:noteId',
    async ({ db, params, query, body }) => {
      const [updatedNote] = await db
        .update(leadNotes)
        .set({
          content: body.content,
          contentHtml: body.content_html,
          isPrivate: body.is_private,
          mentionedUserIds: body.mentioned_user_ids,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leadNotes.id, params.noteId),
            eq(leadNotes.workspaceId, query.workspaceId),
            isNull(leadNotes.deletedAt)
          )
        )
        .returning();

      if (!updatedNote) {
        throw new Error('Note not found');
      }

      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          image: users.image,
        })
        .from(users)
        .where(eq(users.id, updatedNote.createdBy))
        .limit(1);

      return {
        id: updatedNote.id,
        content: updatedNote.content,
        content_html: updatedNote.contentHtml ?? undefined,
        is_private: updatedNote.isPrivate,
        created_at: updatedNote.createdAt?.toISOString() ?? new Date().toISOString(),
        updated_at: updatedNote.updatedAt?.toISOString() ?? undefined,
        created_by: {
          id: user?.id ?? updatedNote.createdBy,
          name: user?.name ?? 'Unknown User',
          avatar: user?.image ?? undefined,
        },
        mentioned_user_ids: updatedNote.mentionedUserIds ?? undefined,
      };
    },
    {
      params: t.Object({
        noteId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        content: t.String(),
        is_private: t.Boolean(),
        mentioned_user_ids: t.Array(t.String()),
        content_html: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Lead Notes'],
        summary: 'Update a note',
      },
    }
  )
  // DELETE /api/v1/crm/leads/notes/:noteId?workspaceId=xxx
  .delete(
    '/notes/:noteId',
    async ({ db, params, query }) => {
      const [deletedNote] = await db
        .update(leadNotes)
        .set({
          deletedAt: new Date(),
        })
        .where(
          and(
            eq(leadNotes.id, params.noteId),
            eq(leadNotes.workspaceId, query.workspaceId),
            isNull(leadNotes.deletedAt)
          )
        )
        .returning();

      if (!deletedNote) {
        throw new Error('Note not found');
      }

      return { success: true, message: 'Note deleted successfully' };
    },
    {
      params: t.Object({
        noteId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Lead Notes'],
        summary: 'Delete a note',
      },
    }
  );

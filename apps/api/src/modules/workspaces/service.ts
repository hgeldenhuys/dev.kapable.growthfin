/**
 * Workspace Service
 * Business logic for workspace operations
 */

import type { Database } from '@agios/db';
import {
  workspaces,
  workspaceMembers,
  workspaceInvitations,
  users,
  crmEmailTemplates,
  crmSmsTemplates,
  crmContactLists,
  crmTemplates,
  crmEnrichmentPipelines,
  crmPipelineStages,
  leadEnrichmentConfigs,
  llmCredentials,
  type NewWorkspace,
  type WorkspaceRole,
} from '@agios/db';
import { eq, and, sql, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { logAuditEvent, AuditActions, ResourceTypes } from './audit';
import { sendInvitationEmail } from './email';

export const workspaceService = {
  async list(db: Database) {
    return db.select().from(workspaces);
  },

  async getById(db: Database, id: string) {
    const results = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return results[0] || null;
  },

  /**
   * List all workspaces for a specific user
   * Returns workspaces with user's role and member count
   */
  async listUserWorkspaces(db: Database, userId: string) {
    // Define wm2 as an alias for workspace_members to use in the subquery
    const wm2 = workspaceMembers;

    const results = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMembers.role,
        settings: workspaces.settings,
        createdAt: workspaces.createdAt,
        // Count members using a subquery
        memberCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${wm2}
          WHERE ${wm2.workspaceId} = ${workspaces.id}
          AND ${wm2.status} = 'active'
        )`,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'active')
        )
      )
      .orderBy(workspaces.createdAt);

    return results;
  },

  /**
   * Get workspace details with member list
   * Returns workspace info plus all members with their roles
   */
  async getWorkspaceDetails(db: Database, workspaceId: string, userId: string) {
    // First, check if workspace exists
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace.length) {
      return { error: 'not_found', message: 'Workspace not found' };
    }

    // Then check if user is a member of the workspace
    const membershipCheck = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId)
        )
      )
      .limit(1);

    if (!membershipCheck.length) {
      return { error: 'forbidden', message: 'User is not a member of this workspace' };
    }

    // Get all members
    const members = await db
      .select({
        userId: workspaceMembers.userId,
        email: users.email,
        name: users.name,
        role: workspaceMembers.role,
        status: workspaceMembers.status,
        joinedAt: workspaceMembers.joinedAt,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(workspaceMembers.joinedAt);

    return {
      workspace: {
        ...workspace[0],
        members,
      },
    };
  },

  async create(db: Database, data: NewWorkspace) {
    // Seed default settings if none provided
    const defaultSettings = {
      platformName: 'GrowthFin',
      smsRateLimit: {
        enabled: true,
        smsPerMinute: 60,
        smsPerHour: 1000,
        smsPerDay: 10000,
        batchSize: 100,
        batchDelayMs: 1000,
      },
      emailRateLimit: {
        enabled: true,
        emailsPerMinute: 100,
        emailsPerHour: 5000,
        emailsPerDay: 50000,
        batchSize: 100,
        batchDelayMs: 500,
      },
      emailCompliance: {
        softBounceThreshold: 3,
        autoSuppressOnComplaint: true,
        autoSuppressOnHardBounce: true,
      },
      sandbox: {
        enabled: false,
        autoSimulateDelivery: true,
        autoSimulateDelayMs: 2000,
      },
    };

    // Merge: user-provided settings override defaults
    const existingSettings = (data.settings && typeof data.settings === 'object') ? data.settings as Record<string, unknown> : {};
    const mergedSettings = { ...defaultSettings, ...existingSettings };

    const results = await db.insert(workspaces).values({ ...data, settings: mergedSettings }).returning();
    const workspace = results[0];

    // Add creator as owner member so workspace is visible via listUserWorkspaces
    if (data.ownerId) {
      const now = new Date();
      await db.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: data.ownerId,
        role: 'owner',
        status: 'active',
        joinedAt: now,
      });
    }

    console.log(`✅ Created workspace ${workspace.id}`);

    return workspace;
  },

  async update(db: Database, id: string, data: Partial<NewWorkspace>) {
    const results = await db
      .update(workspaces)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
    return results[0] || null;
  },

  async delete(db: Database, id: string, requestingUserId?: string) {
    // If requestingUserId provided, validate ownership and member count
    if (requestingUserId) {
      // Check requester is owner
      const requesterResults = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, id),
            eq(workspaceMembers.userId, requestingUserId)
          )
        )
        .limit(1);

      if (!requesterResults.length || requesterResults[0].role !== 'owner') {
        return { error: 'forbidden', message: 'Only workspace owners can delete workspaces' };
      }

      // Check no other active members exist
      const activeMemberCount = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, id),
            eq(workspaceMembers.status, 'active')
          )
        );

      if (activeMemberCount[0].count > 1) {
        return { error: 'bad_request', message: 'Remove all members before deleting this workspace' };
      }
    }

    // Delete workspace members first
    await db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, id));

    const results = await db
      .delete(workspaces)
      .where(eq(workspaces.id, id))
      .returning();

    if (results[0] && requestingUserId) {
      logAuditEvent(db, {
        workspaceId: id,
        userId: requestingUserId,
        action: AuditActions.WORKSPACE_DELETED,
        resourceType: ResourceTypes.WORKSPACE_SETTINGS,
        changes: { before: { name: results[0].name } },
      });
    }

    return results[0] || null;
  },

  /**
   * Clone a workspace
   * Copies config (settings, templates, lists, pipelines, stages, enrichment configs, LLM credentials)
   * Does NOT copy transactional data (leads, contacts, campaigns, etc.)
   * Only workspace owner can clone
   */
  async clone(db: Database, sourceWorkspaceId: string, newName: string, ownerId: string) {
    // Verify source workspace exists
    const sourceResults = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, sourceWorkspaceId))
      .limit(1);

    if (!sourceResults.length) {
      return { error: 'not_found', message: 'Source workspace not found' };
    }

    const source = sourceResults[0];

    // Verify requester is owner of source workspace
    const requesterResults = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, sourceWorkspaceId),
          eq(workspaceMembers.userId, ownerId)
        )
      )
      .limit(1);

    if (!requesterResults.length || requesterResults[0].role !== 'owner') {
      return { error: 'forbidden', message: 'Only workspace owners can clone workspaces' };
    }

    // Generate slug from name
    const baseSlug = newName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check for slug uniqueness, append number if needed
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.slug, slug))
        .limit(1);
      if (!existing.length) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create new workspace with cloned settings
    const newWorkspaceResults = await db
      .insert(workspaces)
      .values({
        name: newName,
        slug,
        ownerId,
        settings: source.settings,
      })
      .returning();

    const newWorkspace = newWorkspaceResults[0];
    const newWorkspaceId = newWorkspace.id;

    // Add owner as member
    const now = new Date();
    await db.insert(workspaceMembers).values({
      workspaceId: newWorkspaceId,
      userId: ownerId,
      role: 'owner',
      status: 'active',
      joinedAt: now,
    });

    // Clone email templates
    const emailTemplatesData = await db
      .select()
      .from(crmEmailTemplates)
      .where(eq(crmEmailTemplates.workspaceId, sourceWorkspaceId));

    for (const tmpl of emailTemplatesData) {
      await db.insert(crmEmailTemplates).values({
        workspaceId: newWorkspaceId,
        name: tmpl.name,
        subject: tmpl.subject,
        body: tmpl.body,
        variables: tmpl.variables,
        category: tmpl.category,
        isActive: tmpl.isActive,
        createdBy: ownerId,
      });
    }

    // Clone SMS templates
    const smsTemplatesData = await db
      .select()
      .from(crmSmsTemplates)
      .where(eq(crmSmsTemplates.workspaceId, sourceWorkspaceId));

    for (const tmpl of smsTemplatesData) {
      await db.insert(crmSmsTemplates).values({
        workspaceId: newWorkspaceId,
        name: tmpl.name,
        body: tmpl.body,
        variables: tmpl.variables,
        category: tmpl.category,
        isActive: tmpl.isActive,
        createdBy: ownerId,
      });
    }

    // Clone contact lists (structure only, no memberships)
    const listsData = await db
      .select()
      .from(crmContactLists)
      .where(eq(crmContactLists.workspaceId, sourceWorkspaceId));

    for (const list of listsData) {
      await db.insert(crmContactLists).values({
        workspaceId: newWorkspaceId,
        name: list.name,
        description: list.description,
        type: list.type,
        status: list.status,
        entityType: list.entityType,
        filterCriteria: list.filterCriteria,
        createdBy: ownerId,
      });
    }

    // Clone enrichment/scoring templates
    const crmTemplatesData = await db
      .select()
      .from(crmTemplates)
      .where(eq(crmTemplates.workspaceId, sourceWorkspaceId));

    for (const tmpl of crmTemplatesData) {
      await db.insert(crmTemplates).values({
        workspaceId: newWorkspaceId,
        name: tmpl.name,
        type: tmpl.type,
        prompt: tmpl.prompt,
        schema: tmpl.schema,
        config: tmpl.config,
        isDefault: tmpl.isDefault,
        version: tmpl.version,
        createdBy: ownerId,
      });
    }

    // Clone enrichment pipelines and their stages (with ID remapping)
    const pipelinesData = await db
      .select()
      .from(crmEnrichmentPipelines)
      .where(eq(crmEnrichmentPipelines.workspaceId, sourceWorkspaceId));

    for (const pipeline of pipelinesData) {
      const oldPipelineId = pipeline.id;

      const newPipelineResults = await db
        .insert(crmEnrichmentPipelines)
        .values({
          workspaceId: newWorkspaceId,
          name: pipeline.name,
          description: pipeline.description,
          isActive: pipeline.isActive,
          config: pipeline.config,
          createdBy: ownerId,
        })
        .returning();

      const newPipelineId = newPipelineResults[0].id;

      // Clone pipeline stages with new pipeline ID
      const stagesData = await db
        .select()
        .from(crmPipelineStages)
        .where(eq(crmPipelineStages.pipelineId, oldPipelineId));

      for (const stage of stagesData) {
        await db.insert(crmPipelineStages).values({
          pipelineId: newPipelineId,
          name: stage.name,
          type: stage.type,
          order: stage.order,
          config: stage.config,
          templateId: null, // Templates have new IDs, can't map 1:1 easily
        });
      }
    }

    // Clone lead enrichment config
    const enrichConfigData = await db
      .select()
      .from(leadEnrichmentConfigs)
      .where(eq(leadEnrichmentConfigs.workspaceId, sourceWorkspaceId));

    for (const cfg of enrichConfigData) {
      await db.insert(leadEnrichmentConfigs).values({
        workspaceId: newWorkspaceId,
        autoEnrichNewLeads: cfg.autoEnrichNewLeads,
        autoEnrichFields: cfg.autoEnrichFields,
        provider: cfg.provider,
        rateLimitPerHour: cfg.rateLimitPerHour,
        linkedinRateLimitPerHour: cfg.linkedinRateLimitPerHour,
        zerobounceRateLimitPerHour: cfg.zerobounceRateLimitPerHour,
        websearchRateLimitPerHour: cfg.websearchRateLimitPerHour,
        linkedinCostPerCall: cfg.linkedinCostPerCall,
        zerobounceCostPerCall: cfg.zerobounceCostPerCall,
        websearchCostPerCall: cfg.websearchCostPerCall,
        budgetLimitMonthly: cfg.budgetLimitMonthly,
        budgetResetDay: cfg.budgetResetDay,
        minConfidenceToApply: cfg.minConfidenceToApply,
      });
    }

    // Clone LLM credentials
    const llmCredsData = await db
      .select()
      .from(llmCredentials)
      .where(eq(llmCredentials.workspaceId, sourceWorkspaceId));

    for (const cred of llmCredsData) {
      await db.insert(llmCredentials).values({
        workspaceId: newWorkspaceId,
        userId: cred.userId,
        name: cred.name,
        provider: cred.provider,
        apiKeyEncrypted: cred.apiKeyEncrypted,
        isActive: cred.isActive,
      });
    }

    // Log audit event
    logAuditEvent(db, {
      workspaceId: newWorkspaceId,
      userId: ownerId,
      action: AuditActions.WORKSPACE_CLONED,
      resourceType: ResourceTypes.WORKSPACE_SETTINGS,
      changes: {
        after: {
          sourceWorkspaceId,
          sourceName: source.name,
          newName,
          newSlug: slug,
        },
      },
    });

    console.log(`✅ Cloned workspace ${sourceWorkspaceId} -> ${newWorkspaceId}`);

    return {
      workspace: {
        id: newWorkspace.id,
        name: newWorkspace.name,
        slug: newWorkspace.slug,
        settings: newWorkspace.settings,
        createdAt: newWorkspace.createdAt,
      },
    };
  },

  /**
   * Send workspace invitation
   * Creates a pending invitation with a unique token
   */
  async sendInvitation(
    db: Database,
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    invitedBy: string
  ) {
    // Validate role (cannot invite as owner)
    if (role === 'owner') {
      return { error: 'bad_request', message: 'Cannot invite users as owner' };
    }

    // Check if requester has permission (admin or owner)
    const requesterMembership = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, invitedBy)
        )
      )
      .limit(1);

    if (!requesterMembership.length) {
      return { error: 'forbidden', message: 'You are not a member of this workspace' };
    }

    const requesterRole = requesterMembership[0].role;
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return { error: 'forbidden', message: 'Only admins and owners can send invitations' };
    }

    // Check if user already exists as member
    const existingMember = await db
      .select()
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(users.email, email)
        )
      )
      .limit(1);

    if (existingMember.length) {
      return { error: 'bad_request', message: 'User is already a member of this workspace' };
    }

    // Check for existing pending invitation
    const existingInvitation = await db
      .select()
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          eq(workspaceInvitations.email, email),
          isNull(workspaceInvitations.acceptedAt)
        )
      )
      .limit(1);

    if (existingInvitation.length) {
      return { error: 'bad_request', message: 'Invitation already pending for this email' };
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('base64url');

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const results = await db
      .insert(workspaceInvitations)
      .values({
        workspaceId,
        email,
        role,
        token,
        invitedBy,
        expiresAt,
      })
      .returning();

    const invitation = results[0];

    // Get workspace and inviter details for email
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    const inviter = await db
      .select()
      .from(users)
      .where(eq(users.id, invitedBy))
      .limit(1);

    // Log audit event (fire-and-forget)
    logAuditEvent(db, {
      workspaceId,
      userId: invitedBy,
      action: AuditActions.INVITED_MEMBER,
      resourceType: ResourceTypes.WORKSPACE_MEMBER,
      changes: {
        after: { email, role },
      },
    });

    // Send invitation email (fire-and-forget)
    if (workspace.length && inviter.length) {
      sendInvitationEmail({
        email,
        workspaceName: workspace[0].name,
        inviterName: inviter[0].name || inviter[0].email,
        role,
        token: invitation.token,
      });
    }

    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
      },
    };
  },

  /**
   * Validate invitation token
   * Returns invitation details if valid, error if expired or not found
   */
  async validateInvitation(db: Database, token: string) {
    const results = await db
      .select({
        id: workspaceInvitations.id,
        email: workspaceInvitations.email,
        role: workspaceInvitations.role,
        expiresAt: workspaceInvitations.expiresAt,
        acceptedAt: workspaceInvitations.acceptedAt,
        workspaceName: workspaces.name,
      })
      .from(workspaceInvitations)
      .innerJoin(workspaces, eq(workspaces.id, workspaceInvitations.workspaceId))
      .where(eq(workspaceInvitations.token, token))
      .limit(1);

    if (!results.length) {
      return { error: 'not_found', message: 'Invalid invitation token' };
    }

    const invitation = results[0];

    // Check if already accepted
    if (invitation.acceptedAt) {
      return { error: 'bad_request', message: 'Invitation has already been accepted' };
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      return { error: 'bad_request', message: 'Invitation has expired' };
    }

    return {
      invitation: {
        workspaceName: invitation.workspaceName,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    };
  },

  /**
   * Accept invitation
   * Creates workspace_members entry and marks invitation as accepted
   */
  async acceptInvitation(db: Database, token: string, userId: string) {
    // Get invitation details
    const invitationResults = await db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.token, token))
      .limit(1);

    if (!invitationResults.length) {
      return { error: 'not_found', message: 'Invalid invitation token' };
    }

    const invitation = invitationResults[0];

    // Check if already accepted
    if (invitation.acceptedAt) {
      return { error: 'bad_request', message: 'Invitation has already been accepted' };
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      return { error: 'bad_request', message: 'Invitation has expired' };
    }

    // Get user's email to verify it matches invitation
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userResults.length) {
      return { error: 'not_found', message: 'User not found' };
    }

    const user = userResults[0];
    if (user.email !== invitation.email) {
      return {
        error: 'forbidden',
        message: 'This invitation was sent to a different email address',
      };
    }

    // Create workspace member
    const memberResults = await db
      .insert(workspaceMembers)
      .values({
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role as WorkspaceRole,
        status: 'active',
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.createdAt,
        joinedAt: new Date(),
      })
      .returning();

    // Mark invitation as accepted
    await db
      .update(workspaceInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(workspaceInvitations.id, invitation.id));

    // Get workspace details
    const workspaceResults = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, invitation.workspaceId))
      .limit(1);

    // Log audit event (fire-and-forget)
    logAuditEvent(db, {
      workspaceId: invitation.workspaceId,
      userId,
      action: AuditActions.ACCEPTED_INVITATION,
      resourceType: ResourceTypes.WORKSPACE_MEMBER,
      changes: {
        after: { userId, role: invitation.role },
      },
    });

    return {
      workspace: {
        id: workspaceResults[0].id,
        name: workspaceResults[0].name,
        role: invitation.role,
      },
    };
  },

  /**
   * Update member role
   * Only admin+ can change roles, only owner can change admin roles
   */
  async updateMemberRole(
    db: Database,
    workspaceId: string,
    memberId: string,
    newRole: WorkspaceRole,
    requestingUserId: string
  ) {
    // Cannot change to owner role
    if (newRole === 'owner') {
      return { error: 'bad_request', message: 'Cannot change role to owner' };
    }

    // Get requesting user's membership
    const requesterResults = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, requestingUserId)
        )
      )
      .limit(1);

    if (!requesterResults.length) {
      return { error: 'forbidden', message: 'You are not a member of this workspace' };
    }

    const requesterRole = requesterResults[0].role;

    // Must be admin or owner
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return { error: 'forbidden', message: 'Only admins and owners can change member roles' };
    }

    // Cannot change own role
    if (memberId === requestingUserId) {
      return { error: 'bad_request', message: 'Cannot change your own role' };
    }

    // Get target member
    const targetResults = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        email: users.email,
        name: users.name,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, memberId)
        )
      )
      .limit(1);

    if (!targetResults.length) {
      return { error: 'not_found', message: 'Member not found' };
    }

    const targetMember = targetResults[0];
    const oldRole = targetMember.role;

    // Only owner can change admin/owner roles
    if (
      (targetMember.role === 'owner' || targetMember.role === 'admin') &&
      requesterRole !== 'owner'
    ) {
      return { error: 'forbidden', message: 'Only workspace owners can change admin roles' };
    }

    // Cannot change owner role
    if (targetMember.role === 'owner') {
      return { error: 'bad_request', message: 'Cannot change the role of a workspace owner' };
    }

    // Update role
    await db
      .update(workspaceMembers)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(workspaceMembers.id, targetMember.id));

    // Log audit event (fire-and-forget)
    logAuditEvent(db, {
      workspaceId,
      userId: requestingUserId,
      action: AuditActions.CHANGED_ROLE,
      resourceType: ResourceTypes.WORKSPACE_MEMBER,
      resourceId: memberId,
      changes: {
        before: { role: oldRole },
        after: { role: newRole },
      },
    });

    return {
      member: {
        userId: targetMember.userId,
        email: targetMember.email,
        name: targetMember.name,
        role: newRole,
        status: 'active',
      },
    };
  },

  /**
   * Add member directly (MVP: Auto-accept, no invitation token)
   * Creates workspace_members entry immediately
   */
  async addMemberDirectly(
    db: Database,
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    invitedBy: string
  ) {
    // Validate role (cannot add as owner)
    if (role === 'owner') {
      return { error: 'bad_request', message: 'Cannot add users as owner' };
    }

    // Check if workspace exists
    const workspaceResults = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspaceResults.length) {
      return { error: 'not_found', message: 'Workspace not found' };
    }

    // Check if user exists
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userResults.length) {
      return { error: 'not_found', message: 'User not found' };
    }

    // Check if user already is a member
    const existingMember = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId)
        )
      )
      .limit(1);

    if (existingMember.length) {
      return { error: 'bad_request', message: 'User is already a member of this workspace' };
    }

    // Create workspace member (auto-accept)
    const now = new Date();
    const memberResults = await db
      .insert(workspaceMembers)
      .values({
        workspaceId,
        userId,
        role,
        status: 'active',
        invitedBy,
        invitedAt: now,
        joinedAt: now, // Auto-accept: joined immediately
      })
      .returning();

    const member = memberResults[0];

    // Log audit event (fire-and-forget)
    logAuditEvent(db, {
      workspaceId,
      userId: invitedBy,
      action: AuditActions.INVITED_MEMBER,
      resourceType: ResourceTypes.WORKSPACE_MEMBER,
      changes: {
        after: { userId, role },
      },
    });

    return {
      member: {
        id: member.id,
        workspaceId: member.workspaceId,
        userId: member.userId,
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt,
        createdAt: member.createdAt,
      },
    };
  },

  /**
   * Remove workspace member
   * Only admin+ can remove members, only owner can remove admins
   * Cannot remove last owner
   */
  async removeMember(
    db: Database,
    workspaceId: string,
    memberId: string,
    requestingUserId: string
  ) {
    // Get requesting user's membership
    const requesterResults = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, requestingUserId)
        )
      )
      .limit(1);

    if (!requesterResults.length) {
      return { error: 'forbidden', message: 'You are not a member of this workspace' };
    }

    const requesterRole = requesterResults[0].role;

    // Must be admin or owner
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return { error: 'forbidden', message: 'Only admins and owners can remove members' };
    }

    // Get target member
    const targetResults = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, memberId)
        )
      )
      .limit(1);

    if (!targetResults.length) {
      return { error: 'not_found', message: 'Member not found' };
    }

    const targetMember = targetResults[0];
    const targetRole = targetMember.role;

    // Only owner can remove admins
    if (
      (targetMember.role === 'owner' || targetMember.role === 'admin') &&
      requesterRole !== 'owner'
    ) {
      return { error: 'forbidden', message: 'Only workspace owners can remove admins' };
    }

    // Cannot remove owner
    if (targetMember.role === 'owner') {
      // Check if this is the last owner
      const ownerCountResult = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.role, 'owner')
          )
        );

      const ownerCount = ownerCountResult[0].count;

      if (ownerCount <= 1) {
        return { error: 'bad_request', message: 'Cannot remove the last owner of a workspace' };
      }
    }

    // Remove member
    await db
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.id, targetMember.id));

    // Log audit event (fire-and-forget)
    logAuditEvent(db, {
      workspaceId,
      userId: requestingUserId,
      action: AuditActions.REMOVED_MEMBER,
      resourceType: ResourceTypes.WORKSPACE_MEMBER,
      resourceId: memberId,
      changes: {
        before: { userId: memberId, role: targetRole },
      },
    });

    return { success: true };
  },
};

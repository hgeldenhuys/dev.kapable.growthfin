# CRM State Machine UI Components - Integration Guide

## Overview

Three new UI components have been created to handle CRM state machine transitions:

1. **LeadContactabilityPanel** - Contact attempts and blacklisting
2. **ContactDispositionPanel** - Disposition updates and opportunity conversion
3. **OpportunityOutcomePanel** - Stage advancement and closing

## Component Locations

```
apps/web/app/components/crm/leads/LeadContactabilityPanel.tsx
apps/web/app/components/crm/contacts/ContactDispositionPanel.tsx
apps/web/app/components/crm/opportunities/OpportunityOutcomePanel.tsx
```

## Hook Locations

```
apps/web/app/hooks/useLeadContactability.ts
apps/web/app/hooks/useContactDisposition.ts
apps/web/app/hooks/useOpportunityOutcome.ts
```

## Integration Examples

### 1. Lead Detail Page

Add the LeadContactabilityPanel to the lead detail page:

```tsx
import { LeadContactabilityPanel } from '~/components/crm/leads/LeadContactabilityPanel';

export default function LeadDetailPage() {
  const { userId, lead } = useLoaderData<typeof loader>();
  const workspaceId = useWorkspaceId();

  return (
    <div className="space-y-6">
      {/* Existing lead info cards... */}

      {/* Add Contactability Panel */}
      <LeadContactabilityPanel
        lead={lead}
        workspaceId={workspaceId}
        userId={userId}
      />
    </div>
  );
}
```

### 2. Contact Detail Page

Add the ContactDispositionPanel to the contact detail page:

```tsx
import { ContactDispositionPanel } from '~/components/crm/contacts/ContactDispositionPanel';

export default function ContactDetailPage() {
  const { userId, contact } = useLoaderData<typeof loader>();
  const workspaceId = useWorkspaceId();

  return (
    <div className="space-y-6">
      {/* Existing contact info cards... */}

      {/* Add Disposition Panel */}
      <ContactDispositionPanel
        contact={contact}
        workspaceId={workspaceId}
        userId={userId}
      />
    </div>
  );
}
```

### 3. Opportunity Detail Page

Add the OpportunityOutcomePanel to the opportunity detail page:

```tsx
import { OpportunityOutcomePanel } from '~/components/crm/opportunities/OpportunityOutcomePanel';

export default function OpportunityDetailPage() {
  const { userId, opportunity } = useLoaderData<typeof loader>();
  const workspaceId = useWorkspaceId();

  return (
    <div className="space-y-6">
      {/* Existing opportunity info cards... */}

      {/* Add Outcome Panel */}
      <OpportunityOutcomePanel
        opportunity={opportunity}
        workspaceId={workspaceId}
        userId={userId}
      />
    </div>
  );
}
```

## Component Features

### LeadContactabilityPanel

**Display:**
- Current contactability state (available/blacklisted/converted)
- Contact attempts counter (X/3)
- Last contact attempt date
- Blacklist information (reason, date, notes)

**Actions:**
- Record Contact Attempt (with outcome selection)
- Blacklist Lead (with reason dropdown)

**State Machine Rules:**
- `no_party`: Increments attempts, auto-blacklists at 3
- `wrong_party`: Immediate blacklist
- `right_party`: Proceeds to qualification

### ContactDispositionPanel

**Display:**
- Current disposition with color-coded badge
- Callback date/notes (if disposition=callback)
- Conversion info (if converted to opportunity)

**Actions:**
- Update Disposition (callback/interested/not_interested/do_not_contact)
- Convert to Opportunity (shown when disposition=interested)

**State Machine Rules:**
- `callback`: Requires callbackDate
- `interested`: Can convert to opportunity
- `not_interested`: Add to nurture
- `do_not_contact`: Compliance block

### OpportunityOutcomePanel

**Display:**
- Current stage with pipeline visualization
- Outcome status (open/won/lost)
- Amount and close date
- Lost reason/notes (if lost)
- Won details (if won)

**Actions:**
- Advance Stage (to next stage in pipeline)
- Close Won (with amount input)
- Close Lost (with reason dropdown)

**Pipeline Stages:**
1. Prospecting
2. Qualification
3. Proposal
4. Negotiation
5. Closed

## API Endpoints Used

### Lead Contactability
- `POST /api/v1/crm/leads/:id/contact-attempt` - Record contact attempt
- `POST /api/v1/crm/leads/:id/blacklist` - Blacklist lead

### Contact Disposition
- `POST /api/v1/crm/contacts/:id/disposition` - Update disposition
- `POST /api/v1/crm/contacts/:id/convert` - Convert to opportunity

### Opportunity Outcome
- `POST /api/v1/crm/opportunities/:id/advance` - Advance stage
- `POST /api/v1/crm/opportunities/:id/close` - Close as won/lost

## Error Handling

All components include:
- Toast notifications for success/error states
- Loading states during API calls
- Validation for required fields
- Automatic React Router revalidation after mutations

## Testing Checklist

- [ ] LeadContactabilityPanel renders correctly on lead detail page
- [ ] Contact attempt recording works with all outcomes
- [ ] Blacklist functionality works with all reasons
- [ ] Auto-blacklist triggers at 3 no-party attempts
- [ ] ContactDispositionPanel renders correctly on contact detail page
- [ ] Disposition update works with all options
- [ ] Callback requires date validation
- [ ] Convert to opportunity creates opportunity correctly
- [ ] OpportunityOutcomePanel renders correctly on opportunity detail page
- [ ] Stage advancement works through pipeline
- [ ] Close won validates amount
- [ ] Close lost records reason
- [ ] All mutations trigger toast notifications
- [ ] All mutations trigger data revalidation

## Styling

Components use shadcn/ui components:
- Card, CardHeader, CardTitle, CardContent
- Button (with variants: default, outline, destructive)
- Badge (with variants: default, success, destructive)
- Dialog, DialogContent, DialogHeader, DialogFooter
- Select, SelectTrigger, SelectContent, SelectItem
- Input, Textarea, Label

All components follow the existing design system and are fully responsive.

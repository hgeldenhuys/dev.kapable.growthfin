# Documentation Components

React components for viewing and presenting feature documentation in the Agios CRM application.

## Components

### FeatureCard

Displays a feature summary card for the documentation index.

**Props:**
- `id`: Feature identifier (string)
- `title`: Feature name (string)
- `category`: Feature category (string)
- `status`: Feature status ('stable' | 'beta' | 'planned' | 'deprecated' | 'development')
- `completeness`: Documentation completeness percentage (0-100)
- `businessValue`: Business value summary (string)
- `technicalSummary`: Technical overview (optional string)
- `featureCount`: Number of capabilities (optional number)
- `workspaceId`: Workspace context (optional string)

**Usage:**
```tsx
<FeatureCard
  id="contacts"
  title="Contacts Management"
  category="CRM"
  status="stable"
  completeness={85}
  businessValue="Unified contact management with automatic enrichment"
  featureCount={3}
  workspaceId={workspaceId}
/>
```

### DocNav

Table of contents navigation with scroll spy for documentation pages.

**Props:**
- `headings`: Array of heading objects ({ id, text, level })
- `className`: Optional CSS class (string)

**Usage:**
```tsx
<DocNav headings={[
  { id: 'overview', text: 'Overview', level: 2 },
  { id: 'capabilities', text: 'Capabilities', level: 2 },
]} />
```

### DocViewer

MDX renderer with syntax highlighting and custom components.

**Props:**
- `children`: React nodes to render
- `className`: Optional CSS class (string)

**Custom MDX Components:**
- `Callout`: Info, warning, tip, error callouts
- `CodeBlock`: Syntax-highlighted code with copy button
- Custom heading, link, list, table, and blockquote components

**Usage:**
```tsx
<DocViewer>
  <MDXContent />
</DocViewer>
```

### FeatureDocContent

Renders YAML feature documentation in a user-friendly format.

**Props:**
- `doc`: FeatureDocumentation object

**Usage:**
```tsx
<FeatureDocContent doc={featureDoc} />
```

### SlideControls

Controls for Reveal.js presentations.

**Props:**
- `totalSlides`: Total number of slides (number)
- `currentSlide`: Current slide index (number)
- `isPlaying`: Auto-advance state (boolean)
- `onTogglePlay`: Play/pause handler (function)
- `onToggleFullscreen`: Fullscreen toggle handler (function)
- `onToggleNotes`: Notes toggle handler (function)
- `isFullscreen`: Fullscreen state (boolean)
- `showNotes`: Notes visibility state (boolean)
- `className`: Optional CSS class (string)

**Usage:**
```tsx
<SlideControls
  totalSlides={10}
  currentSlide={0}
  isPlaying={false}
  onTogglePlay={() => setPlaying(!playing)}
  onToggleFullscreen={toggleFullscreen}
  onToggleNotes={() => setShowNotes(!showNotes)}
  isFullscreen={false}
  showNotes={false}
/>
```

## Routes

### `/dashboard/:workspaceId/docs`

Documentation index showing all features with filtering and search.

**Features:**
- Grid view of all documented features
- Search across feature content
- Filter by category and status
- Stats overview
- Responsive design

### `/dashboard/:workspaceId/docs/:featureId`

Detailed documentation viewer for a specific feature.

**Features:**
- Full feature documentation
- Table of contents navigation
- Metadata display (completeness, last updated, etc.)
- Related features links
- Responsive with sticky TOC sidebar

## Documentation Loader

Utility functions for loading and parsing YAML feature documentation.

**Location:** `app/lib/docs-loader.ts`

**Functions:**

#### `getAllFeatures(): FeatureDocumentation[]`

Loads all feature documentation files from `.claude/sdlc/docs/features/`.

#### `loadFeatureDoc(featureId: string): FeatureDocumentation | null`

Loads a specific feature documentation file.

#### `getFeatureSummary(doc: FeatureDocumentation): FeatureSummary`

Extracts summary information for feature cards.

#### `extractHeadings(doc: FeatureDocumentation): Heading[]`

Generates table of contents headings from documentation.

## Styling

Custom styles in `app/styles/docs.css`:

- `.docs-content`: Content container with optimal line length
- `.docs-nav`: Sticky navigation sidebar
- Code block styling with syntax highlighting
- Responsive adjustments
- Print styles
- Dark mode support

## YAML Documentation Format

Feature documentation is stored in YAML files at `.claude/sdlc/docs/features/{featureId}.yaml`.

**Structure:**
- `type`: Always "feature-documentation"
- `version`: Schema version
- `feature`: Metadata (id, name, icon, order, category, status)
- `metadata`: Timestamps, owners, relationships
- `overview`: Business value, target users
- `capabilities`: Workflows, talking points, technical details
- `integrations`: Related features and data flow
- `faq`: Frequently asked questions
- `metrics`: Completeness and demo metrics

**Example:**
```yaml
type: feature-documentation
version: 1.0.0

feature:
  id: contacts
  name: Contacts Management
  status: development
  category: core

overview:
  headline: Unified contact management
  description: Complete CRM contact management...
  businessValue:
    - metric: Data Entry Time
      impact: 80% reduction
      explanation: Automatic enrichment...
```

## Testing

Test script: `test/scripts/test-docs-loader.ts`

Run: `bun run test/scripts/test-docs-loader.ts`

Tests:
- YAML loading
- Feature extraction
- Summary generation
- Path resolution

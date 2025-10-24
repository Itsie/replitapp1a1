# Design Guidelines: 1aShirt Production & Order Management System

## Design Approach

**Selected Approach**: Design System-Inspired (Productivity-Focused)

**Rationale**: This is a utility-focused enterprise application for production management. All five factors indicate a function-first approach: efficiency, data density, stability, and standard patterns are paramount. The system handles complex workflows across multiple roles and departments.

**Primary Inspiration**: Linear (clean data-first aesthetic) + Notion (flexible content organization) + Modern SaaS dashboards (Asana, Monday.com for scheduling views)

**Core Principles**:
1. Data clarity over decoration
2. Efficient workflows with minimal clicks
3. Consistent patterns across all modules
4. Clear visual hierarchy for role-based views

---

## Typography

**Font Stack**:
- **Primary**: Inter (via Google Fonts CDN)
- **Monospace**: JetBrains Mono (for order numbers, technical IDs)

**Type Scale**:
- Page Titles: text-2xl font-semibold (32px)
- Section Headers: text-lg font-semibold (20px)
- Card/Panel Titles: text-base font-medium (16px)
- Body Text: text-sm (14px)
- Labels/Captions: text-xs font-medium uppercase tracking-wide (12px)
- Table Data: text-sm (14px)

**Hierarchy Rules**:
- Dashboard titles use text-2xl with generous bottom margin
- Form labels use text-xs uppercase for clear field identification
- Status badges use text-xs font-medium
- All headings use font-semibold or font-medium, never font-bold

---

## Layout System

**Spacing Units**: Use Tailwind units of **2, 4, 6, 8, 12, 16** consistently
- Component padding: p-4 or p-6
- Section spacing: space-y-6 or space-y-8
- Card gaps: gap-4
- Form field spacing: space-y-4
- Page margins: p-6 lg:p-8

**Container Strategy**:
- Full-width dashboard with fixed sidebar navigation (w-64)
- Main content area: max-w-7xl mx-auto with p-6
- Cards and panels: bg-white dark:bg-gray-800 with rounded-lg border
- Nested content uses max-w-4xl for optimal reading width on detail pages

**Grid Patterns**:
- Order overview: 3-column grid (grid-cols-3 gap-4) for status cards
- Production slots: Full-width calendar/timeline view
- Data tables: Full width with horizontal scroll on mobile
- Form layouts: 2-column on desktop (grid-cols-2 gap-6), single column on mobile

---

## Component Library

### Navigation
**Sidebar Navigation**:
- Fixed left sidebar (w-64, h-screen)
- Logo/brand at top (h-16 with p-4)
- Role-based menu sections with dividers
- Active state: subtle background fill, left border accent
- Icons from Heroicons (solid for active, outline for inactive)

**Top Bar**:
- Breadcrumb navigation (text-sm with separators)
- User profile dropdown (right-aligned)
- Quick action buttons (New Order, Import JTL)

### Data Display

**Order Cards**:
- Compact card layout with border-l-4 for workflow state indication
- Header: Order number (monospace) + title
- Meta row: Department badge, customer name, due date
- Footer: Status badge, QC state, action buttons
- Hover state: subtle shadow elevation

**Data Tables**:
- Striped rows (hover:bg-gray-50)
- Sticky header row
- Sortable columns with icon indicators
- Row actions: icon-only buttons (edit, delete, more)
- Pagination controls at bottom
- Filters in collapsible panel above table

**Status Badges**:
- Rounded-full px-3 py-1 text-xs font-medium
- Different visual treatment per workflow state
- Icons inline with text when needed

**Timeline/Calendar View** (Production Planning):
- Grid-based layout with time columns (15-min increments)
- Drag-and-drop slots with clear boundaries
- WorkCenter rows with capacity indicators
- Blocked slots with diagonal stripe pattern
- Current time indicator (vertical line)

### Forms

**Input Fields**:
- Label above input (text-xs font-medium uppercase text-gray-600)
- Input: border rounded-md px-3 py-2 focus:ring-2 focus:ring-offset-0
- Helper text below (text-xs text-gray-500)
- Error state: red border + error message

**Select Dropdowns**:
- Native styled selects for simple cases
- Custom dropdown for complex selections (department, workflow state)

**File Upload**:
- Drag-and-drop zone with dashed border
- File list with preview thumbnails
- Remove button per file
- Upload progress indicator

**Button Hierarchy**:
- Primary: Solid fill for main actions
- Secondary: Outline style for alternative actions
- Tertiary: Ghost/text-only for minor actions
- Danger: Red accent for destructive actions
- Sizes: px-4 py-2 (default), px-3 py-1.5 (small)

### Overlays

**Modals**:
- Centered overlay with max-w-2xl
- Header with title and close button
- Content area with p-6
- Footer with action buttons (right-aligned)
- Backdrop blur

**Side Panels**:
- Slide-in from right (w-96 or w-1/2)
- For detailed views or quick edits
- Close button top-right

**Toasts/Notifications**:
- Top-right positioned
- Auto-dismiss after 5 seconds
- Success/error/info variants with icons

---

## Animations

**Minimal Motion**:
- Transitions only for state changes (duration-200)
- Hover states: subtle scale or opacity changes
- No page transitions or scroll animations
- Loading states: simple spinner or skeleton screens

---

## Page-Specific Layouts

### Dashboard (Home)
- 3-column metrics cards at top (grid-cols-3)
- Recent orders list below (max 10 items)
- Quick actions sidebar widget

### Order List View
- Filters panel (collapsible, left side or top)
- Table or card grid (switchable view)
- Bulk actions toolbar when items selected
- Pagination at bottom

### Order Detail View
- Header with breadcrumb, order number, primary actions
- Tabbed interface: Details, Size Table, Print Assets, Production Schedule, History
- Each tab: max-w-4xl content area with appropriate forms/tables

### Production Planning
- Week view by default (Mon-Fri columns)
- WorkCenter rows on left (sticky)
- Time grid: 7:00-18:00 in 15-min increments
- Drag-and-drop slots with visual feedback
- Legend for slot types (assigned, blocked, available)

### JTL Import
- File upload zone prominent
- Import preview table after upload
- Validation messages per row
- Confirm import button with summary

### Billing Queue
- Table view with status filter tabs
- Status change dropdown per row
- Export to CSV button
- Comment inline editing

---

## Responsive Behavior

**Breakpoints**:
- Mobile: < 640px (stack everything)
- Tablet: 640px-1024px (2-column layouts, collapsible sidebar)
- Desktop: > 1024px (full layouts)

**Mobile Adaptations**:
- Sidebar becomes bottom navigation or hamburger menu
- Cards stack single-column
- Tables show critical columns only with expand button
- Production calendar switches to day view

---

## Images

**No hero images required** - This is an internal production tool, not a marketing site.

**Icons**: Heroicons (outline and solid variants via CDN)

**Placeholder Images**: For missing print assets, use simple icon + "No file uploaded" text in gray box
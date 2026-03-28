# Storyboard Schema Change Guide

This guide explains how to update the frontend UI when the AgentOS `StoryboardWorkflow` JSON response structure changes.

## Overview

The storyboard feature converts script text into a visual frame-by-frame breakdown. The AgentOS `StoryboardWorkflow` generates JSON output that the frontend maps into UI components.

When the workflow's output schema changes (e.g., new fields added, field names changed), you need to update corresponding TypeScript types and mapping functions.

## New Enrichment Fields (v2.0)

As of the latest update, the storyboard workflow now outputs enriched metadata for each shot/frame:

- **characters**: Array of character names appearing in this frame
- **locations**: Array of location names in this frame
- **dialogues**: Array of dialogue objects with `speaker`, `text`, and `type` ('dialogue' or 'narration')
- **prompts**: Object containing:
  - `textToImage`: Text-to-image prompt (base prompt with character/location names intact)
  - `imageGuided`: Image-guided prompt (derived on frontend by replacing names with descriptions)
  - `textToVideo`: Text-to-video prompt (action-focused description)

### Auto Mode for Image Generation

The frontend now automatically selects between **text-to-image** and **image-guided** generation:

1. **Text-to-Image**: No reference images → uses `prompts.textToImage` directly
2. **Image-Guided**: Has reference images (from characters/locations) → uses `prompts.imageGuided`
   - `imageGuided` is derived on-the-fly by replacing character/location names with their descriptions from the asset library
   - Example: "七海" → "一个20岁年轻女生，长发双马尾"
   - This ensures multi-character/location consistency when using reference images

The `imageGuided` prompt is persisted back to the frame after first generation for reuse and review.

## Key Files to Update

### 1. TypeScript Models (`lib/models.ts`)

This file defines the TypeScript interfaces for the storyboard JSON structure.

**Current Structure (v2.0 with enrichments):**
```typescript
export interface Shot {
  shot_number: string;        // 镜头编号
  shot_size: string;          // 景别
  duration_seconds: number;   // 时长（秒）
  scene_description: string;  // 画面描述
  director_notes: string;     // 导演提示
  audio_description: string;  // 音频描述
  camera_angle: string;       // 机位角度
  camera_movement: string;    // 运镜方式
  focal_length: string;       // 焦距
  
  // New enrichment fields (v2.0)
  characters?: string[];      // Character names in this shot
  locations?: string[];       // Location names in this shot
  dialogues?: Array<{
    speaker?: string;         // Speaker name or "旁白"
    text: string;             // Dialogue/narration text
    type?: 'dialogue' | 'narration';
  }>;
  prompts?: {
    textToImage?: string;     // Text-to-image prompt (base)
    imageGuided?: string;     // Image-guided prompt (derived, persisted)
    textToVideo?: string;     // Text-to-video prompt
  };
}

export interface StoryboardScene {
  id: string;
  title: string;
  summary: string;
  shots: Shot[];
}

export interface StoryboardResponse {
  projectId: string;
  scenes: StoryboardScene[];
}
```

**Example Change:**
If the workflow adds a new field `lighting_notes` to `Shot`:

```typescript
export interface Shot {
  shot_number: string;
  shot_size: string;
  duration_seconds: number;
  scene_description: string;
  director_notes: string;
  audio_description: string;
  camera_angle: string;
  camera_movement: string;
  focal_length: string;
  lighting_notes: string;      // NEW FIELD
}
```

### 2. Storyboard Page Mapping (`app/projects/[id]/@content/storyboard/page.tsx`)

This file contains the `storyboardJsonToFrames()` function that converts the AgentOS JSON into `FrameData` objects for the UI.

**Current Mapping:**
```typescript
function storyboardJsonToFrames(data: StoryboardResponse): FrameData[] {
  const frames: FrameData[] = [];
  let order = 1;
  
  data.scenes.forEach(scene => {
    scene.shots.forEach(shot => {
      // Parse scene title to extract type and time
      const isEXT = scene.title.toUpperCase().includes('EXT');
      const isNight = scene.title.includes('夜') || scene.title.toUpperCase().includes('NIGHT');
      
      frames.push({
        id: `${scene.id}-${shot.shot_number}`,
        order: order++,
        title: scene.title,
        sceneType: isEXT ? 'EXT.' : 'INT.',
        timeOfDay: isNight ? '夜' : '日',
        description: scene.summary,
        bulletPoints: [],
        
        // Shot-specific fields
        shot_number: shot.shot_number,
        shot_size: shot.shot_size,
        duration_seconds: shot.duration_seconds,
        scene_description: shot.scene_description,
        director_notes: shot.director_notes,
        audio_description: shot.audio_description,
        camera_angle: shot.camera_angle,
        camera_movement: shot.camera_movement,
        focal_length: shot.focal_length,
      });
    });
  });
  
  return frames;
}
```

**Example Change:**
To add the new `lighting_notes` field:

```typescript
frames.push({
  id: `${scene.id}-${shot.shot_number}`,
  order: order++,
  title: scene.title,
  sceneType: isEXT ? 'EXT.' : 'INT.',
  timeOfDay: isNight ? '夜' : '日',
  description: scene.summary,
  bulletPoints: [],
  
  // Shot-specific fields
  shot_number: shot.shot_number,
  shot_size: shot.shot_size,
  duration_seconds: shot.duration_seconds,
  scene_description: shot.scene_description,
  director_notes: shot.director_notes,
  audio_description: shot.audio_description,
  camera_angle: shot.camera_angle,
  camera_movement: shot.camera_movement,
  focal_length: shot.focal_length,
  lighting_notes: shot.lighting_notes,  // NEW FIELD
});
```

### 3. Frame Data Interface (`components/storyboard/FrameCard.tsx`)

If the new field should be displayed or editable in the UI, update the `FrameData` interface:

**Current Interface (v2.0):**
```typescript
export interface FrameData {
  id: string;
  order: number;
  title: string;
  sceneType: string;
  timeOfDay: string;
  description: string;
  bulletPoints: string[];
  image?: ImageItem;
  
  // Optional shot metadata
  shot_number?: string;
  shot_size?: string;
  duration_seconds?: number;
  scene_description?: string;
  director_notes?: string;
  audio_description?: string;
  camera_angle?: string;
  camera_movement?: string;
  focal_length?: string;
  
  referenceImages?: string[];
  referencePaths?: string[]; // Storage paths for API calls
  
  // New enrichment fields (v2.0)
  characters?: string[];
  locations?: string[];
  dialogues?: Array<{
    speaker?: string;
    text: string;
    type?: 'dialogue' | 'narration';
  }>;
  prompts?: {
    textToImage?: string;
    imageGuided?: string;
    textToVideo?: string;
  };
}
```

**Example Change:**
```typescript
export interface FrameData {
  // ... existing fields ...
  focal_length?: string;
  lighting_notes?: string;  // NEW FIELD
  
  referenceImages?: string[];
}
```

### 4. UI Display (`components/storyboard/FrameCard.tsx`)

If the new field should be visible in the card UI, add it to the render logic:

**Example:**
```tsx
{/* Expanded Details */}
{isExpanded && (
  <div className="px-3 pb-3 space-y-2 text-xs text-slate-600">
    <div><strong>导演提示:</strong> {frame.director_notes || '-'}</div>
    <div><strong>音频:</strong> {frame.audio_description || '-'}</div>
    <div><strong>运镜:</strong> {frame.camera_movement || '-'}</div>
    <div><strong>灯光:</strong> {frame.lighting_notes || '-'}</div>  {/* NEW */}
  </div>
)}
```

## Backend Import Route

The backend route that accepts and caches storyboard JSON is:
- `backend/src/api/routes/storyboard.ts` - `POST /api/projects/:projectId/storyboard/import`

This route typically **doesn't need changes** when the schema evolves, as it stores the JSON as-is. However, if caching keys depend on specific field names, you may need to adjust them.

## Checklist

When the `StoryboardWorkflow` JSON changes:

1. ✅ Update `lib/models.ts` types (`Shot`, `StoryboardScene`, `StoryboardResponse`)
2. ✅ Update `storyboardJsonToFrames()` mapping in `app/projects/[id]/@content/storyboard/page.tsx`
3. ✅ Update `FrameData` interface in `lib/types/storyboard.ts` (if field should be editable/visible)
4. ✅ Update UI render logic in `FrameCard.tsx` or other components (if field should be displayed)
5. ✅ Test import flow: upload script → generate storyboard → verify new fields appear
6. ✅ Check backend cache keys in `backend/src/api/routes/storyboard.ts` (if schema changes affect caching)

## Example: Adding a New Top-Level Field

If the workflow adds a new top-level field like `metadata`:

```typescript
export interface StoryboardResponse {
  projectId: string;
  scenes: StoryboardScene[];
  metadata?: {
    totalDuration: number;
    shotCount: number;
  };
}
```

You would:
1. Add it to `StoryboardResponse` in `lib/models.ts`
2. Optionally display it in the storyboard page header
3. No changes needed to `storyboardJsonToFrames()` unless you want to use it in the mapping

## Testing

After making changes:
1. Upload a script via `/projects/[id]/input`
2. Generate a storyboard
3. Navigate to `/projects/[id]/storyboard`
4. Verify all fields (old and new) display correctly
5. Check browser console for TypeScript errors

## Reference

- AgentOS workflow: `backend/agentos/storyboard_workflow.py`
- Frontend models: `lib/models.ts`
- Storyboard page: `app/projects/[id]/@content/storyboard/page.tsx`
- Frame card: `components/storyboard/FrameCard.tsx`


# Multi-Photo Gallery Implementation Plan

## Overview
Add support for users to attach up to 10 photos per post with a swipeable gallery interface.

## Current State Analysis

### Data Model (src/types.ts:3-16)
```typescript
export interface Post {
  id: string;
  userId: string;
  handle?: string;
  avatarKey?: string;
  text: string;
  imageKey?: string;              // ⚠️ Single image only
  imageAspectRatio?: number;      // ⚠️ Single aspect ratio
  createdAt: string;
  updatedAt?: string;
  reactionCount?: number;
  commentCount?: number;
  comments?: Comment[];
}
```

### API (src/api/posts.ts:153-154)
```typescript
export async function createPost(text: string, imageKey?: string, imageAspectRatio?: number)
// ⚠️ Accepts only single imageKey and aspectRatio
```

### Upload Flow (src/screens/ComposePostScreen.tsx)
- Uses `expo-image-picker` for single image selection
- Compresses images to max 1920x1920px with 0.8 JPEG quality
- Uploads to S3 via presigned URLs (`uploadMedia` function)
- Caches aspect ratio for layout optimization
- Cleanup logic deletes unused images

### Display (src/components/PostCard.tsx:505-531)
- Renders single image with aspect ratio
- Uses `react-native-image-viewing` for full-screen zoom
- Optimized CDN URLs (800px feed, 1200px fullscreen)

---

## Proposed Changes

### 1. Data Model Changes

#### Option A: Array of Image Objects (RECOMMENDED)
```typescript
export interface PostImage {
  key: string;                    // S3 key
  aspectRatio: number;           // width/height for layout
  width?: number;                // Optional original dimensions
  height?: number;
  order: number;                 // Display order (0-9)
}

export interface Post {
  id: string;
  userId: string;
  handle?: string;
  avatarKey?: string;
  text: string;

  // NEW: Multi-image support
  images?: PostImage[];          // Array of up to 10 images

  // DEPRECATED: Keep for backward compatibility with old posts
  imageKey?: string;
  imageAspectRatio?: number;

  createdAt: string;
  updatedAt?: string;
  reactionCount?: number;
  commentCount?: number;
  comments?: Comment[];
}
```

**Pros:**
- Structured data with metadata per image
- Easy to maintain order
- Extensible (can add captions, filters later)
- Backward compatible

**Cons:**
- Larger payload size
- More complex schema

#### Option B: Simple Arrays (Simpler)
```typescript
export interface Post {
  images?: string[];              // Array of S3 keys
  imageAspectRatios?: number[];   // Parallel array
  // ...
}
```

**Pros:**
- Minimal changes
- Smaller payload

**Cons:**
- Harder to extend
- Parallel arrays can get out of sync
- Less type-safe

**RECOMMENDATION: Option A** - Better structure, easier to extend

---

### 2. UI/UX Design Options

#### Feed Display Options

##### Option 1: Instagram-Style Single Image + Indicator (RECOMMENDED)
```
┌─────────────────────┐
│                     │
│   [First Image]     │
│                     │
│          ┌────────┐ │
│          │  1/5   │ │ <- Page indicator
│          └────────┘ │
└─────────────────────┘
• • • • ○  <- Dot pagination
```

**Implementation:**
- Show first image in feed
- Display page indicator badge (e.g., "1/5") in top-right corner
- Optional: Dot indicators at bottom
- Swipe left/right to navigate
- Tap to open full-screen viewer

**Pros:**
- Clean, familiar UX (Instagram, Twitter)
- Doesn't increase feed height
- Clear indication of more images
- Good performance (lazy load non-visible images)

**Cons:**
- Users might miss additional images if indicator is subtle

##### Option 2: Horizontal Thumbnail Strip
```
┌───────────────────────────────┐
│ [Main Image - First Photo]    │
│                               │
└───────────────────────────────┘
┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
│ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │  <- Scrollable thumbnails
└───┘ └───┘ └───┘ └───┘ └───┘
```

**Pros:**
- All images visible at once
- Clear visual indicator

**Cons:**
- Increases post height significantly
- More complex layout
- Higher memory usage

##### Option 3: Grid Layout (2x2 or 3x3)
```
┌─────────┬─────────┐
│    1    │    2    │
├─────────┼─────────┤
│    3    │  +2     │  <- "+2" overlay for more
└─────────┴─────────┘
```

**Pros:**
- Compact
- Shows multiple images

**Cons:**
- Fixed layouts awkward for different image counts
- Doesn't work well for 1-3 images
- Increases feed height

**RECOMMENDATION: Option 1 (Instagram-style)** - Best balance of simplicity, performance, and UX

---

### 3. Gallery Component Library Research

#### Option 1: Built-in FlatList with Pagination (RECOMMENDED)
**Implementation:**
```tsx
<FlatList
  data={post.images}
  horizontal
  pagingEnabled
  showsHorizontalScrollIndicator={false}
  onScroll={handleScroll}
  renderItem={({ item }) => <Image source={{ uri: item }} />}
/>
```

**Pros:**
- No additional dependencies
- Native performance
- Full control over behavior
- Already familiar to team

**Cons:**
- Need to implement pagination indicator manually
- Need to manage scroll position

#### Option 2: react-native-image-viewing (Already Installed!)
**Current Usage:** src/components/PostCard.tsx:695-702

The library **already supports multiple images**:
```tsx
<ImageViewing
  images={[{ uri: url1 }, { uri: url2 }, { uri: url3 }]}  // ✅ Supports arrays!
  imageIndex={0}
  visible={visible}
  onRequestClose={() => setVisible(false)}
/>
```

**Pros:**
- Already installed (no new dependencies)
- Supports multiple images out of the box
- Great for full-screen viewing
- Swipe gestures built-in

**Cons:**
- Only for full-screen viewing, not for in-feed carousel

#### Option 3: react-native-reanimated-carousel
**Installation:** `npm install react-native-reanimated-carousel react-native-reanimated`

**Pros:**
- Modern, actively maintained
- Excellent performance with Reanimated
- Rich features (parallax, loop, etc.)

**Cons:**
- Additional dependencies (reanimated is large)
- Might be overkill for simple use case
- Learning curve

#### Option 4: Simple ScrollView with pagingEnabled
```tsx
<ScrollView
  horizontal
  pagingEnabled
  onScroll={handleScroll}
  scrollEventThrottle={16}
>
  {images.map(img => <Image key={img.key} source={{ uri: img }} />)}
</ScrollView>
```

**Pros:**
- Minimal, simple
- No dependencies

**Cons:**
- Less performant than FlatList for many images
- All images rendered at once (not ideal for 10 images)

**RECOMMENDATION: FlatList for in-feed carousel + react-native-image-viewing for full-screen**
- No new dependencies needed
- Best performance
- Native behavior

---

### 4. Upload Flow Design

#### Current Flow (Single Image)
1. User taps "Add Photo"
2. Picks from camera/gallery
3. Image compressed (max 1920x1920, JPEG 0.8)
4. Uploaded to S3 via presigned URL
5. Returns `imageKey`
6. On post creation, sends `imageKey` + `aspectRatio` to backend

#### Proposed Flow (Multi-Image)

```
┌────────────────────────────────────────┐
│  ComposePostScreen                     │
│                                        │
│  [Image 1] [Image 2] [Image 3]         │ <- Horizontal thumbnail strip
│     [X]      [X]      [X]              │    with remove buttons
│                                        │
│  [+ Add Photo] (3/10)                  │ <- Count indicator
└────────────────────────────────────────┘
```

**Implementation Steps:**

1. **State Management:**
```tsx
const [images, setImages] = useState<Array<{
  uri: string;           // Local URI
  key?: string;          // S3 key (after upload)
  aspectRatio: number;
  uploading: boolean;
  error?: string;
}>>([]);
```

2. **Image Selection:**
- Allow multiple selection via `expo-image-picker`
- `allowsMultipleSelection: true` option
- Enforce max 10 images client-side
- Show count indicator "X/10"

3. **Upload Strategy:**

**Option A: Upload All at Once (When Post Button Pressed)**
- Pros: Simpler flow, no orphaned uploads
- Cons: Slow post creation, poor UX for slow connections

**Option B: Upload Immediately After Selection (RECOMMENDED)**
- Pros: Better UX, instant feedback, faster post creation
- Cons: Need cleanup for unused uploads
- Implementation: Parallel uploads with progress tracking

4. **Progress Tracking:**
```tsx
{images.map((img, idx) => (
  <View key={idx}>
    <Image source={{ uri: img.uri }} />
    {img.uploading && <ProgressBar progress={img.progress} />}
    {img.error && <ErrorIcon />}
    <RemoveButton onPress={() => removeImage(idx)} />
  </View>
))}
```

5. **Reordering:**
- Optional: Allow drag-to-reorder (react-native-draggable-flatlist)
- Or keep insertion order (simpler)

6. **Cleanup:**
```tsx
useEffect(() => {
  return () => {
    // On unmount, delete all uploaded images if post wasn't created
    if (!postedRef.current) {
      images.forEach(img => {
        if (img.key) deleteMedia(img.key);
      });
    }
  };
}, [images]);
```

---

### 5. API Changes

#### Backend Requirements

**POST /posts** - Create Post
```json
{
  "text": "Check out these photos!",
  "images": [
    {
      "key": "uploads/user123/abc123.jpg",
      "aspectRatio": 1.5,
      "width": 1920,
      "height": 1280,
      "order": 0
    },
    {
      "key": "uploads/user123/def456.jpg",
      "aspectRatio": 0.75,
      "width": 1280,
      "height": 1920,
      "order": 1
    }
  ]
}

// Backward compatibility: still accept single image
{
  "text": "Old format",
  "imageKey": "uploads/user123/xyz.jpg",
  "imageAspectRatio": 1.33
}
```

**GET /feed** - Response
```json
{
  "posts": [
    {
      "id": "post123",
      "text": "My post",
      "images": [
        { "key": "...", "aspectRatio": 1.5, "order": 0 },
        { "key": "...", "aspectRatio": 1.2, "order": 1 }
      ],
      // Deprecated but included for old clients
      "imageKey": "...",  // First image for compatibility
      "imageAspectRatio": 1.5
    }
  ]
}
```

#### Client-Side API Updates

**src/api/posts.ts:153-154**
```typescript
// NEW: Multi-image support
export async function createPost(
  text: string,
  images?: Array<{
    key: string;
    aspectRatio: number;
    width?: number;
    height?: number;
  }>
) {
  return api('/posts', {
    method: 'POST',
    body: JSON.stringify({
      text,
      images: images?.map((img, index) => ({
        ...img,
        order: index
      }))
    })
  });
}

// DEPRECATED: Keep for backward compatibility
export async function createPostLegacy(
  text: string,
  imageKey?: string,
  imageAspectRatio?: number
) {
  return api('/posts', {
    method: 'POST',
    body: JSON.stringify({ text, imageKey, imageAspectRatio })
  });
}
```

#### Migration Strategy

1. **Phase 1: Backend Update**
   - Backend accepts both `images[]` array and legacy `imageKey`
   - Backend always returns both formats for compatibility
   - Old mobile clients continue working

2. **Phase 2: Mobile Update**
   - Mobile app updated to use `images[]` array
   - Displays galleries for new posts
   - Fallback to `imageKey` for old posts

3. **Phase 3: Cleanup (Future)**
   - Remove deprecated `imageKey` field after all clients updated

---

### 6. Component Architecture

#### New Components

**1. ImageGallery.tsx** - In-Feed Carousel
```tsx
interface ImageGalleryProps {
  images: PostImage[];
  onPress?: (index: number) => void;
  style?: ViewStyle;
}

// Renders:
// - FlatList with horizontal pagination
// - Page indicator badge ("1/5")
// - Dot pagination (optional)
```

**2. ImageGalleryViewer.tsx** - Full-Screen Viewer
```tsx
interface ImageGalleryViewerProps {
  images: PostImage[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

// Uses react-native-image-viewing with multiple images
```

**3. MultiImagePicker.tsx** - Upload UI
```tsx
interface MultiImagePickerProps {
  images: UploadingImage[];
  maxImages?: number;
  onImagesChange: (images: UploadingImage[]) => void;
}

// Renders:
// - Horizontal thumbnail strip
// - Upload progress per image
// - Remove buttons
// - Add photo button with count
```

#### Updated Components

**PostCard.tsx** (src/components/PostCard.tsx)
```tsx
// Replace single image rendering (lines 505-531) with:
{post.images && post.images.length > 0 ? (
  <ImageGallery
    images={post.images}
    onPress={(index) => {
      setImageViewerIndex(index);
      setImageViewerVisible(true);
    }}
  />
) : post.imageKey ? (
  // Fallback for legacy posts with single imageKey
  <Image source={{ uri: optimizedMediaUrl(post.imageKey) }} />
) : null}

// Update image viewer (lines 695-702):
<ImageGalleryViewer
  images={post.images || [{ key: post.imageKey, aspectRatio: post.imageAspectRatio }]}
  initialIndex={imageViewerIndex}
  visible={imageViewerVisible}
  onClose={() => setImageViewerVisible(false)}
/>
```

**ComposePostScreen.tsx** (src/screens/ComposePostScreen.tsx)
```tsx
// Replace single image state (lines 28-30) with:
const [images, setImages] = useState<UploadingImage[]>([]);

// Replace pickImage function to support multiple selection
// Replace single image preview (lines 273-291) with MultiImagePicker
<MultiImagePicker
  images={images}
  maxImages={10}
  onImagesChange={setImages}
/>
```

---

## Implementation Phases

### Phase 1: Foundation (Estimated: 2-3 days)
**Goal:** Update data models and create base components

**Tasks:**
1. ✅ Update `src/types.ts` - Add `PostImage` interface and `images[]` to `Post`
2. ✅ Create `src/components/ImageGallery.tsx` - Basic horizontal FlatList carousel
3. ✅ Create `src/components/ImageGalleryViewer.tsx` - Wrapper for react-native-image-viewing
4. ✅ Add page indicator component (badge with "X/Y")

**Deliverables:**
- Updated type definitions
- Working gallery components (can test with mock data)
- No API integration yet

### Phase 2: Upload Flow (Estimated: 2-3 days)
**Goal:** Enable users to select and upload multiple images

**Tasks:**
1. ✅ Update `expo-image-picker` to support multiple selection
2. ✅ Create `src/components/MultiImagePicker.tsx`
3. ✅ Implement parallel upload with progress tracking
4. ✅ Add image reordering (optional, can defer)
5. ✅ Update cleanup logic for multiple images
6. ✅ Add validation (max 10 images, file size limits)

**Deliverables:**
- Users can select up to 10 images
- Images upload in background with progress
- Thumbnail preview with remove buttons

### Phase 3: API Integration (Estimated: 1-2 days)
**Goal:** Connect to backend for creating multi-image posts

**Tasks:**
1. ✅ Update `src/api/posts.ts` - Modify `createPost` function
2. ✅ Update `ComposePostScreen.tsx` - Pass images array to API
3. ✅ Handle backward compatibility for old posts
4. ✅ Test creating posts with 1, 5, and 10 images

**Deliverables:**
- Can create posts with multiple images
- Images saved to backend correctly

### Phase 4: Display Integration (Estimated: 2 days)
**Goal:** Show multi-image galleries in feed and post detail screens

**Tasks:**
1. ✅ Update `PostCard.tsx` - Integrate ImageGallery component
2. ✅ Update `PostScreen.tsx` - Show full gallery
3. ✅ Handle legacy posts with single `imageKey`
4. ✅ Test feed scrolling performance with galleries
5. ✅ Add optimized image URLs for gallery images

**Deliverables:**
- Feed displays image galleries with page indicators
- Can swipe through images in feed
- Can tap to view full-screen gallery
- Old posts still display correctly

### Phase 5: Polish & Testing (Estimated: 1-2 days)
**Goal:** Refine UX and fix edge cases

**Tasks:**
1. ✅ Add loading states and error handling
2. ✅ Optimize performance (lazy loading, image caching)
3. ✅ Test edge cases:
   - Single image (should still work)
   - 10 images (max limit)
   - Slow network (upload progress)
   - Failed uploads (retry/error states)
4. ✅ Accessibility (screen reader support for page indicators)
5. ✅ Polish animations and transitions

**Deliverables:**
- Smooth, polished user experience
- Robust error handling
- Good performance even with many images

---

## Technical Considerations

### Performance Optimization

1. **Lazy Loading:**
   - Only render visible images in carousel
   - Use `FlatList` with `windowSize` prop
   - Load full-res only when viewing full-screen

2. **Image Optimization:**
   - Feed: 400px width per thumbnail
   - Carousel: 800px width
   - Full-screen: 1200px width
   - Use CDN parameters for optimization

3. **Memory Management:**
   - Clear image cache when scrolling feed
   - Limit concurrent uploads to 3-4
   - Use `Image.prefetch()` for next/prev images

### Edge Cases

1. **Single Image Posts:**
   - Should render same as before (no regression)
   - No page indicators for single image

2. **Mixed Old/New Posts:**
   - Old posts use `imageKey`
   - New posts use `images[]`
   - Display component handles both

3. **Failed Uploads:**
   - Show error state per image
   - Allow retry individual images
   - Don't block posting if some images uploaded

4. **Cleanup:**
   - Delete uploaded images if user cancels
   - Handle app backgrounding during upload
   - Retry mechanism for network failures

### Accessibility

1. **Screen Readers:**
   - Announce "Image X of Y"
   - Alt text support (future enhancement)
   - Swipe gestures work with VoiceOver/TalkBack

2. **Visual Indicators:**
   - High contrast page indicator badge
   - Large enough tap targets for thumbnails
   - Clear loading/error states

---

## Open Questions for User

1. **Image Limit:**
   - Confirm 10 images max?
   - Should we start with lower limit (e.g., 5) and increase later?

2. **Feed Display:**
   - Preference for Option 1 (Instagram-style), Option 2 (thumbnails), or Option 3 (grid)?
   - Should we show dot indicators, or just numeric badge?

3. **Image Ordering:**
   - Keep insertion order, or allow drag-to-reorder?
   - Worth the added complexity?

4. **Backward Compatibility:**
   - Should old posts be migrated to new format, or just displayed differently?
   - Is the backend already deployed, or can we coordinate schema changes?

5. **Additional Features:**
   - Image captions per photo?
   - Filters/editing before posting?
   - Video support in future?

---

## Recommended Approach

**For Initial Implementation:**

1. **Data Model:** Option A (PostImage interface with metadata)
2. **Feed Display:** Option 1 (Instagram-style carousel with page indicator)
3. **Gallery Library:** FlatList + react-native-image-viewing (no new deps)
4. **Upload Strategy:** Immediate upload after selection
5. **Max Images:** Start with 10, can adjust

**Rationale:**
- Minimal new dependencies (use existing libraries)
- Familiar UX pattern (Instagram-like)
- Performant and scalable
- Extensible for future features

**Timeline Estimate:** 7-12 days total for all phases

**Risk Areas:**
- Backend schema changes (need coordination)
- Performance with many images in feed (needs testing)
- Upload reliability on poor networks (needs robust retry logic)

---

## Next Steps

1. **User Approval:** Review this plan and answer open questions
2. **Backend Coordination:** Confirm API contract and schema changes
3. **Phase 1 Implementation:** Start with data models and base components
4. **Iterative Development:** Build and test each phase incrementally

# Stickers Directory

This directory contains static sticker images that can be sent in chat messages.

## Directory Structure

```
stickers/
  ├── emotions/     # Happy, sad, love, angry, etc.
  ├── reactions/    # Thumbs up, clap, fire, etc.
  └── animals/      # Cat, dog, panda, etc.
```

## Adding Stickers

### 1. Upload Images

- Place sticker images in the appropriate category folder
- **Recommended format**: WebP or PNG with transparency
- **Recommended size**: 512x512px or 256x256px
- **File naming**: Use lowercase with hyphens (e.g., `happy-face.webp`, `thumbs-up.png`)

### 2. Add to Database

After uploading images, you need to add them to the database. You can use Prisma Studio or run a SQL script:

```sql
-- Example: Adding a sticker
INSERT INTO "Sticker" (id, name, "imageUrl", category, "createdAt")
VALUES (
  gen_random_uuid(),
  'Happy Face',
  '/stickers/emotions/happy-face.webp',
  'emotions',
  NOW()
);
```

Or use Prisma Client:

```typescript
await prisma.sticker.create({
  data: {
    name: 'Happy Face',
    imageUrl: '/stickers/emotions/happy-face.webp',
    category: 'emotions',
  },
});
```

## Categories

- **emotions**: Emotional expressions (happy, sad, love, angry, surprised, etc.)
- **reactions**: Quick reactions (thumbs up, clap, fire, heart, star, etc.)
- **animals**: Animal stickers (cat, dog, panda, fox, etc.)

## Image Guidelines

- Keep file sizes small (< 100KB per sticker)
- Use transparent backgrounds when possible
- Ensure images are square (1:1 aspect ratio)
- Optimize images before uploading (use tools like TinyPNG or Squoosh)

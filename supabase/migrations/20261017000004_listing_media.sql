-- Post media from Pexels (scripts/fetch-media.mjs): a short portrait clip (≤ 20 s) or a photo.
-- image_url holds the photo, or the clip's poster frame, so every thumbnail keeps working;
-- video_url is set only for clips. media_credit / media_credit_url credit the creator.
alter table listings
  add column if not exists video_url text,
  add column if not exists media_credit text,
  add column if not exists media_credit_url text;

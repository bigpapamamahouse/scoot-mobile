import React from 'react';
import ImageViewing from 'react-native-image-viewing';
import { PostImage } from '../types';
import { mediaUrlFromKey } from '../lib/media';

interface ImageGalleryViewerProps {
  images: PostImage[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export function ImageGalleryViewer({
  images,
  initialIndex = 0,
  visible,
  onClose,
}: ImageGalleryViewerProps) {
  // Convert PostImage array to format expected by react-native-image-viewing
  // Use raw URLs without optimization params (CloudFront doesn't support query params yet)
  const imageUris = images
    .map(img => {
      const uri = mediaUrlFromKey(img.key);
      return uri ? { uri } : null;
    })
    .filter((img): img is { uri: string } => img !== null);

  return (
    <ImageViewing
      images={imageUris}
      imageIndex={initialIndex}
      visible={visible}
      onRequestClose={onClose}
    />
  );
}

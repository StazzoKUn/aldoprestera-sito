import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/*.{png,jpg,jpeg,webp}', { eager: true });

/** Risolve il nome file di una voce del menù (es. "pizza-crudo-rucola.png") nell'immagine importata */
export const menuImage = (name?: string): ImageMetadata | undefined =>
  name ? files[`../assets/${name}`]?.default : undefined;

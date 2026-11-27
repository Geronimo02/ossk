export type ProductCategory =
  | 'remeras'
  | 'buzos'
  | 'baggys'
  | 'bermudas'
  | 'accesorios'
  | 'medias';

export type BrandDrop =
  | 'OSSK VOL.1'
  | 'ANIMAL'
  | 'FRESCO'
  | 'ENDLESS SUMMER'
  | 'OSSK DENIM';

export interface ProductMeasure {
  s: string;
  w: number;
  l: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  brand: BrandDrop;
  vendor: string;
  price: number;
  fit: string;
  badge?: string;
  fabric: string;
  description: string;
  sizes: string[];
  images: [string, string];
  viewLabels: [string, string];
  measures: ProductMeasure[];
  /** Optional path to a scanned .glb/.gltf model (e.g. '/models/zip-animal-red.glb') */
  modelUrl?: string;
}

export interface RunwayPiece {
  productId: string;
  x: number;
  y: number;
  flatX: number;
  flatY: number;
  callout: string;
  arrowDir?: 'left' | 'right';
  tag?: string;
}

export interface RunwayLook {
  name: string;
  dropLabel: string;
  image: string;
  flatlayImage: string;
  pieces: RunwayPiece[];
}

export interface CommunityPost {
  id: string;
  tag: string;
  title: string;
  caption: string;
  image: string;
  actionLabel: string;
  actionType: 'loupe' | 'runway';
  targetId: string | number;
}

export const OSSK_WHATSAPP = '5492494000000';

export const CATEGORY_FILTERS: ReadonlyArray<{ id: 'all' | ProductCategory; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'remeras', label: 'Remeras' },
  { id: 'buzos', label: 'Buzos & Camperas' },
  { id: 'baggys', label: 'Baggys' },
  { id: 'bermudas', label: 'Bermudas' },
  { id: 'accesorios', label: 'Accesorios' },
  { id: 'medias', label: 'Medias' },
];

export const BRAND_FILTERS: ReadonlyArray<{ id: 'all' | BrandDrop; label: string }> = [
  { id: 'all', label: 'Todas las marcas' },
  { id: 'OSSK VOL.1', label: 'OSSK VOL.1' },
  { id: 'ANIMAL', label: 'ANIMAL' },
  { id: 'FRESCO', label: 'FRESCO' },
  { id: 'ENDLESS SUMMER', label: 'ENDLESS SUMMER' },
  { id: 'OSSK DENIM', label: 'OSSK DENIM' },
];

export const SIZE_FILTERS: ReadonlyArray<string> = ['all', 'S', 'M', 'L', 'XL', 'U'];

export const PRODUCTS: Product[] = [
  {
    id: 'zip-animal-red',
    sku: 'OSK-AN-01',
    name: 'Zip Hoodie Animal Stars Rojo',
    category: 'buzos',
    brand: 'ANIMAL',
    vendor: 'ANIMAL · DROP ROJO',
    price: 79900,
    fit: 'Boxy Zip Oversize',
    badge: 'DROP',
    fabric: 'Frisa invisible 420g · Estrellas bordadas en capucha',
    description:
      'Buzo con cierre metálico pesado en rojo carmesí con parches de estrellas negras en capucha. Caída boxy con cintura estructurada.',
    sizes: ['S', 'M', 'L', 'XL'],
    images: [
      '/src/assets/images/flatlay_animal_red_1795728618450.jpg',
      '/src/assets/images/look_animal_red_color_1795728614960.jpg',
    ],
    viewLabels: ['Flat-lay', 'Puesto'],
    measures: [
      { s: 'S', w: 60, l: 66 },
      { s: 'M', w: 63, l: 68 },
      { s: 'L', w: 66, l: 71 },
      { s: 'XL', w: 69, l: 73 },
    ],
  },
  {
    id: 'baggy-camu-trio',
    sku: 'OSK-BG-01',
    name: 'Baggy Camu Wide-Leg',
    category: 'baggys',
    brand: 'OSSK VOL.1',
    vendor: 'OSSK VOL.1 · BAGGYS CAMU',
    price: 74900,
    fit: 'Baggy Wide-Leg',
    badge: 'DROP',
    fabric: 'Sarga pesada 13oz · Camo Woodland / Arena / Rosa',
    description:
      'El clásico Baggy Camu del local. Pierna ultra ancha con bolsillos cargo y caída recta sobre zapatilla. Disponible en 3 tonos camo.',
    sizes: ['S', 'M', 'L', 'XL'],
    images: [
      '/src/assets/images/prod_baggy_camu_trio_1795728619994.jpg',
      '/src/assets/images/look_camo_baggy_color_1795728616429.jpg',
    ],
    viewLabels: ['Flat-lay', 'Puesto'],
    measures: [
      { s: 'S', w: 40, l: 103 },
      { s: 'M', w: 43, l: 105 },
      { s: 'L', w: 46, l: 107 },
      { s: 'XL', w: 49, l: 109 },
    ],
  },
  {
    id: 'crew-endless-stars',
    sku: 'OSK-ES-01',
    name: 'Crewneck Endless Summer Stars',
    category: 'buzos',
    brand: 'ENDLESS SUMMER',
    vendor: 'ENDLESS SUMMER',
    price: 68500,
    fit: 'Boxy Washed',
    badge: 'NEW',
    fabric: 'Algodón lavado ácido 400g · Estrellas en mangas',
    description:
      'Buzo cuello redondo pre-lavado carbón con estrellas bordadas a lo largo de ambas mangas. Hombro caído y puño firme.',
    sizes: ['S', 'M', 'L', 'XL'],
    images: [
      '/src/assets/images/flatlay_endless_denim_1795728619698.jpg',
      '/src/assets/images/look_endless_denim_color_1795728615723.jpg',
    ],
    viewLabels: ['Flat-lay', 'Puesto'],
    measures: [
      { s: 'S', w: 58, l: 67 },
      { s: 'M', w: 61, l: 69 },
      { s: 'L', w: 64, l: 72 },
      { s: 'XL', w: 67, l: 74 },
    ],
  },
  {
    id: 'bermuda-camo-jort',
    sku: 'OSK-BM-01',
    name: 'Bermuda Camo Jort Wide',
    category: 'bermudas',
    brand: 'OSSK VOL.1',
    vendor: 'OSSK VOL.1 · BERMUDAS',
    price: 54900,
    fit: 'Jort Bajo Rodilla',
    badge: 'TOP',
    fabric: 'Ripstop camuflado 290g · Ruedo desflecado',
    description:
      'Bermuda ancha debajo de la rodilla en camo woodland, bolsillos cargo laterales y calce holgado ideal con medias altas.',
    sizes: ['S', 'M', 'L', 'XL'],
    images: [
      '/src/assets/images/prod_bermuda_camo_jort_1795728623121.jpg',
      '/src/assets/images/community_mirror_rug_1795728623814.jpg',
    ],
    viewLabels: ['Flat-lay', 'En local'],
    measures: [
      { s: 'S', w: 40, l: 58 },
      { s: 'M', w: 42, l: 60 },
      { s: 'L', w: 45, l: 62 },
      { s: 'XL', w: 48, l: 64 },
    ],
  },
  {
    id: 'remera-fresco-sleeveless',
    sku: 'OSK-FR-01',
    name: 'Musculosa Boxy Fresco Archive',
    category: 'remeras',
    brand: 'FRESCO',
    vendor: 'FRESCO · ARCHIVE',
    price: 36900,
    fit: 'Boxy Sin Mangas',
    badge: 'NEW',
    fabric: 'Jersey peinado 240g · Estampa frente',
    description:
      'Corte cuadrado ancho en blanco tiza con sisa amplia y gráfica editorial en pecho. Calce liviano pero con cuerpo.',
    sizes: ['S', 'M', 'L', 'XL'],
    images: [
      '/src/assets/images/look_fresco_plaid_color_1795728617591.jpg',
      '/src/assets/images/flatlay_camo_street_1795728619655.jpg',
    ],
    viewLabels: ['Puesto', 'Flat-lay'],
    measures: [
      { s: 'S', w: 56, l: 67 },
      { s: 'M', w: 59, l: 69 },
      { s: 'L', w: 62, l: 72 },
      { s: 'XL', w: 65, l: 74 },
    ],
  },
  {
    id: 'baggy-plaid-fresco',
    sku: 'OSK-FR-02',
    name: 'Baggy Cuadros Tierra',
    category: 'baggys',
    brand: 'FRESCO',
    vendor: 'FRESCO · BOTTOMS',
    price: 72000,
    fit: 'Baggy Wide Straight',
    fabric: 'Sarga escocesa 11oz · Pinzas frontales',
    description:
      'Pantalón ancho a cuadros en tonos tierra y oliva con caída fluida recta. Combina directo con boxy tees y zapatillas bajas.',
    sizes: ['S', 'M', 'L', 'XL'],
    images: [
      '/src/assets/images/look_fresco_plaid_color_1795728617591.jpg',
      '/src/assets/images/community_grid_wall_1795728626607.jpg',
    ],
    viewLabels: ['Puesto', 'En local'],
    measures: [
      { s: 'S', w: 39, l: 101 },
      { s: 'M', w: 42, l: 103 },
      { s: 'L', w: 45, l: 105 },
      { s: 'XL', w: 48, l: 107 },
    ],
  },
  {
    id: 'remera-boxy-240',
    sku: 'OSK-RM-01',
    name: 'Remera Boxy 240g Ink',
    category: 'remeras',
    brand: 'OSSK VOL.1',
    vendor: 'OSSK VOL.1 · ESSENTIALS',
    price: 34900,
    fit: 'Boxy Fit',
    badge: 'TOP',
    fabric: 'Jersey peinado 20/1 · 240g lavado',
    description:
      'Cuello rib 2.5cm bien cerrado que no cede. Largo contenido y ancho generoso para caída cuadrada limpia sobre baggys.',
    sizes: ['S', 'M', 'L', 'XL'],
    images: [
      '/src/assets/images/flatlay_camo_street_1795728619655.jpg',
      '/src/assets/images/look_camo_baggy_color_1795728616429.jpg',
    ],
    viewLabels: ['Flat-lay', 'Puesto'],
    measures: [
      { s: 'S', w: 55, l: 68 },
      { s: 'M', w: 58, l: 70 },
      { s: 'L', w: 61, l: 73 },
      { s: 'XL', w: 64, l: 75 },
    ],
  },
  {
    id: 'baggy-stonewash-blue',
    sku: 'OSK-DN-01',
    name: 'Jean Baggy Blue Stonewash',
    category: 'baggys',
    brand: 'OSSK DENIM',
    vendor: 'OSSK DENIM',
    price: 76000,
    fit: 'Baggy Straight',
    fabric: 'Denim rígido 14oz · Lavado celeste vintage',
    description:
      'Jean 5 bolsillos de pierna ancha en denim azul lavado con caída limpia sobre el empeine. El básico de todos los outfits OSSK.',
    sizes: ['S', 'M', 'L', 'XL'],
    images: [
      '/src/assets/images/flatlay_endless_denim_1795728619698.jpg',
      '/src/assets/images/look_endless_denim_color_1795728615723.jpg',
    ],
    viewLabels: ['Flat-lay', 'Puesto'],
    measures: [
      { s: 'S', w: 39, l: 102 },
      { s: 'M', w: 42, l: 104 },
      { s: 'L', w: 44, l: 106 },
      { s: 'XL', w: 47, l: 108 },
    ],
  },
  {
    id: 'hoodie-asfalto-420',
    sku: 'OSK-HD-01',
    name: 'Hoodie Boxy Asfalto 420g',
    category: 'buzos',
    brand: 'OSSK VOL.1',
    vendor: 'OSSK VOL.1 · HEAVYWEIGHT',
    price: 74900,
    fit: 'Boxy Oversize',
    fabric: 'Frisa invisible 420g · 100% algodón',
    description:
      'Hombro caído, capucha doble sin cordón y puños elastizados de alto gramaje. Estructura firme en negro tinta.',
    sizes: ['S', 'M', 'L', 'XL'],
    images: [
      '/src/assets/images/prod_hoodie_asfalto_1795726327738.jpg',
      '/src/assets/images/look_asfalto_nocturno_1795726320769.jpg',
    ],
    viewLabels: ['Estudio', 'Puesto'],
    measures: [
      { s: 'S', w: 59, l: 67 },
      { s: 'M', w: 62, l: 69 },
      { s: 'L', w: 65, l: 72 },
      { s: 'XL', w: 68, l: 74 },
    ],
  },
  {
    id: 'campera-denim-raw',
    sku: 'OSK-DN-02',
    name: 'Campera Workwear Denim Negro',
    category: 'buzos',
    brand: 'OSSK DENIM',
    vendor: 'OSSK DENIM · OUTERWEAR',
    price: 98000,
    fit: 'Relaxed Boxy',
    badge: 'LIMITED',
    fabric: 'Denim rígido 14oz · Herrajes mate',
    description:
      'Chaqueta estructurada con bolsillos frontales utilitarios y lavado enzimático sutil. Edición limitada en Rodríguez 743.',
    sizes: ['S', 'M', 'L', 'XL'],
    images: [
      '/src/assets/images/prod_campera_denim_1795726331506.jpg',
      '/src/assets/images/look_workwear_743_1795726322482.jpg',
    ],
    viewLabels: ['Estudio', 'Puesto'],
    measures: [
      { s: 'S', w: 58, l: 64 },
      { s: 'M', w: 61, l: 66 },
      { s: 'L', w: 64, l: 68 },
      { s: 'XL', w: 67, l: 70 },
    ],
  },
  {
    id: 'cap-6panel',
    sku: 'OSK-AC-01',
    name: 'Cap 6-Panel Washed Ink',
    category: 'accesorios',
    brand: 'OSSK VOL.1',
    vendor: 'OSSK VOL.1 · ACCESORIOS',
    price: 24500,
    fit: 'Ajustable',
    fabric: 'Sarga de algodón lavado · Hebilla mate',
    description:
      'Gorra 6 paneles sin estructura rígida, visera curva pre-formada y calce bajo. Ideal para cerrar cualquier combo con 10% OFF.',
    sizes: ['U'],
    images: [
      '/src/assets/images/prod_cap_6panel_1795726332947.jpg',
      '/src/assets/images/flatlay_camo_street_1795728619655.jpg',
    ],
    viewLabels: ['Estudio', 'Flat-lay'],
    measures: [{ s: 'U', w: 58, l: 12 }],
  },
  {
    id: 'medias-ossk-3pack',
    sku: 'OSK-MD-01',
    name: 'Medias Crew OSSK 3-Pack',
    category: 'medias',
    brand: 'OSSK VOL.1',
    vendor: 'OSSK VOL.1 · MEDIAS',
    price: 14900,
    fit: 'Caña Media Ribbed',
    badge: 'COMBO',
    fabric: 'Algodón peinado grueso · Doble línea carmesí',
    description:
      'Pack x3 (blanco, carbón y melange) con doble raya en rojo OSSK. Sumalas a 2 prendas para destrabar el 10% OFF en combo.',
    sizes: ['U'],
    images: [
      '/src/assets/images/prod_medias_ossk_1795728623900.jpg',
      '/src/assets/images/flatlay_animal_red_1795728618450.jpg',
    ],
    viewLabels: ['Flat-lay', 'En outfit'],
    measures: [{ s: 'U', w: 39, l: 44 }],
  },
];

export const RUNWAY_LOOKS: RunwayLook[] = [
  {
    name: 'Animal Rojo',
    dropLabel: 'DROP · ANIMAL × OSSK',
    image: '/src/assets/images/look_animal_red_color_1795728614960.jpg',
    flatlayImage: '/src/assets/images/flatlay_animal_red_1795728618450.jpg',
    pieces: [
      {
        productId: 'zip-animal-red',
        x: 50,
        y: 34,
        flatX: 50,
        flatY: 31,
        callout: 'ANIMAL · ZIP ROJO',
        arrowDir: 'right',
        tag: 'New',
      },
      {
        productId: 'baggy-stonewash-blue',
        x: 51,
        y: 66,
        flatX: 48,
        flatY: 67,
        callout: 'JEAN BAGGY',
        arrowDir: 'left',
      },
      {
        productId: 'medias-ossk-3pack',
        x: 62,
        y: 86,
        flatX: 76,
        flatY: 63,
        callout: 'MEDIAS OSSK',
        arrowDir: 'right',
      },
    ],
  },
  {
    name: 'Camu Street',
    dropLabel: 'OSSK VOL.1 · BAGGYS CAMU',
    image: '/src/assets/images/look_camo_baggy_color_1795728616429.jpg',
    flatlayImage: '/src/assets/images/flatlay_camo_street_1795728619655.jpg',
    pieces: [
      {
        productId: 'remera-boxy-240',
        x: 50,
        y: 35,
        flatX: 39,
        flatY: 30,
        callout: 'BOXY 240G',
        arrowDir: 'left',
        tag: 'New',
      },
      {
        productId: 'baggy-camu-trio',
        x: 49,
        y: 64,
        flatX: 38,
        flatY: 66,
        callout: 'BAGGY CAMU',
        arrowDir: 'right',
      },
      {
        productId: 'cap-6panel',
        x: 50,
        y: 14,
        flatX: 72,
        flatY: 29,
        callout: 'CAP INK',
        arrowDir: 'right',
      },
    ],
  },
  {
    name: 'Endless Stars',
    dropLabel: 'ENDLESS SUMMER × DENIM',
    image: '/src/assets/images/look_endless_denim_color_1795728615723.jpg',
    flatlayImage: '/src/assets/images/flatlay_endless_denim_1795728619698.jpg',
    pieces: [
      {
        productId: 'crew-endless-stars',
        x: 49,
        y: 36,
        flatX: 52,
        flatY: 31,
        callout: 'ENDLESS STARS',
        arrowDir: 'right',
        tag: 'New',
      },
      {
        productId: 'baggy-stonewash-blue',
        x: 50,
        y: 66,
        flatX: 50,
        flatY: 63,
        callout: 'BLUE STONEWASH',
        arrowDir: 'left',
      },
      {
        productId: 'medias-ossk-3pack',
        x: 64,
        y: 85,
        flatX: 51,
        flatY: 84,
        callout: 'MEDIAS CREW',
        arrowDir: 'right',
      },
    ],
  },
  {
    name: 'Fresco Plaid',
    dropLabel: 'FRESCO · ARCHIVE',
    image: '/src/assets/images/look_fresco_plaid_color_1795728617591.jpg',
    flatlayImage: '/src/assets/images/community_grid_wall_1795728626607.jpg',
    pieces: [
      {
        productId: 'remera-fresco-sleeveless',
        x: 51,
        y: 35,
        flatX: 54,
        flatY: 42,
        callout: 'FRESCO · BOXY',
        arrowDir: 'right',
      },
      {
        productId: 'baggy-plaid-fresco',
        x: 49,
        y: 65,
        flatX: 34,
        flatY: 68,
        callout: 'BAGGY CUADROS',
        arrowDir: 'left',
      },
      {
        productId: 'medias-ossk-3pack',
        x: 61,
        y: 86,
        flatX: 52,
        flatY: 20,
        callout: 'MEDIAS OSSK',
        arrowDir: 'right',
      },
    ],
  },
  {
    name: 'Workwear 743',
    dropLabel: 'OSSK DENIM · LIMITED',
    image: '/src/assets/images/look_workwear_743_1795726322482.jpg',
    flatlayImage: '/src/assets/images/flatlay_camo_street_1795728619655.jpg',
    pieces: [
      {
        productId: 'campera-denim-raw',
        x: 40,
        y: 34,
        flatX: 39,
        flatY: 30,
        callout: 'DENIM 14OZ',
        arrowDir: 'left',
        tag: 'New',
      },
      {
        productId: 'baggy-camu-trio',
        x: 52,
        y: 64,
        flatX: 39,
        flatY: 66,
        callout: 'BAGGY CAMU',
        arrowDir: 'right',
      },
      {
        productId: 'cap-6panel',
        x: 53,
        y: 16,
        flatX: 72,
        flatY: 29,
        callout: 'CAP 6-PANEL',
        arrowDir: 'right',
      },
    ],
  },
  {
    name: 'Asfalto 420',
    dropLabel: 'OSSK VOL.1 · CORE',
    image: '/src/assets/images/look_asfalto_nocturno_1795726320769.jpg',
    flatlayImage: '/src/assets/images/flatlay_endless_denim_1795728619698.jpg',
    pieces: [
      {
        productId: 'hoodie-asfalto-420',
        x: 50,
        y: 36,
        flatX: 52,
        flatY: 32,
        callout: 'HOODIE 420G',
        arrowDir: 'right',
      },
      {
        productId: 'bermuda-camo-jort',
        x: 49,
        y: 63,
        flatX: 50,
        flatY: 63,
        callout: 'BERMUDA JORT',
        arrowDir: 'left',
      },
      {
        productId: 'cap-6panel',
        x: 52,
        y: 16,
        flatX: 20,
        flatY: 54,
        callout: 'CAP INK',
        arrowDir: 'left',
      },
    ],
  },
];

export const COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'mirror-rug',
    tag: 'PROBADOR · RODRÍGUEZ 743',
    title: 'Fit-check en la alfombra OSSK',
    caption: 'Bermuda Camo Jort + Medias Crew en el espejo del local.',
    image: '/src/assets/images/community_mirror_rug_1795728623814.jpg',
    actionLabel: 'Ver Bermuda Camo',
    actionType: 'loupe',
    targetId: 'bermuda-camo-jort',
  },
  {
    id: 'grid-wall',
    tag: 'MURO GRID · LOOK DEL DÍA',
    title: 'Curaduría en el local',
    caption: 'Baggys Camu Arena + tejido pesado armados directo en la pared.',
    image: '/src/assets/images/community_grid_wall_1795728626607.jpg',
    actionLabel: 'Ver Baggy Camu',
    actionType: 'loupe',
    targetId: 'baggy-camu-trio',
  },
  {
    id: 'flatlay-red',
    tag: 'OUTFIT OSSK · FLAT-LAY',
    title: 'Animal Stars + Jean Baggy',
    caption: 'El combo rojo insignia sobre piso de cemento. 10% OFF llevando las 3.',
    image: '/src/assets/images/flatlay_animal_red_1795728618450.jpg',
    actionLabel: 'Probar Look 01',
    actionType: 'runway',
    targetId: 0,
  },
  {
    id: 'flatlay-camo',
    tag: 'STYLEANDO · DROP CAMU',
    title: 'Boxy Ink + Baggy Woodland',
    caption: 'Base negra 240g, camo ancho, gorra lavada y medias crew.',
    image: '/src/assets/images/flatlay_camo_street_1795728619655.jpg',
    actionLabel: 'Probar Look 02',
    actionType: 'runway',
    targetId: 1,
  },
];

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

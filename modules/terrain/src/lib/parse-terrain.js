import Martini from '@mapbox/martini';
import {getMeshBoundingBox} from '@loaders.gl/loader-utils';
import TinyQueue from 'tinyqueue';

function getTerrain(imageData, tileSize, elevationDecoder) {
  const {rScaler, bScaler, gScaler, offset} = elevationDecoder;

  const gridSize = tileSize + 1;
  // From Martini demo
  // https://observablehq.com/@mourner/martin-real-time-rtin-terrain-mesh
  const terrain = new Float32Array(gridSize * gridSize);
  // decode terrain values
  for (let i = 0, y = 0; y < tileSize; y++) {
    for (let x = 0; x < tileSize; x++, i++) {
      const k = i * 4;
      const r = imageData[k + 0];
      const g = imageData[k + 1];
      const b = imageData[k + 2];
      terrain[i + y] = r * rScaler + g * gScaler + b * bScaler + offset;
    }
  }
  // backfill bottom border
  for (let i = gridSize * (gridSize - 1), x = 0; x < gridSize - 1; x++, i++) {
    terrain[i] = terrain[i - gridSize];
  }
  // backfill right border
  for (let i = gridSize - 1, y = 0; y < gridSize; y++, i += gridSize) {
    terrain[i] = terrain[i - 1];
  }
  return terrain;
}

// eslint-disable-next-line max-statements
function getMeshAttributes(vertices, terrain, tileSize, bounds, skirt) {
  const gridSize = tileSize + 1;
  const numOfVerticies = vertices.length / 2;
  // const maxSkirtVertices = skirtHeight ? (tileSize - 1) * 4 : 0;
  // vec3. x, y in pixels, z in meters
  const positions = new Float32Array(numOfVerticies * 3);
  // vec2. 1 to 1 relationship with position. represents the uv on the texture image. 0,0 to 1,1.
  const texCoords = new Float32Array(numOfVerticies * 2);

  const [minX, minY, maxX, maxY] = bounds || [0, 0, tileSize, tileSize];
  const xScale = (maxX - minX) / tileSize;
  const yScale = (maxY - minY) / tileSize;

  // Initialize queues for creating skirts for each edge
  const edges = {
    left: new TinyQueue([], (a, b) => a.y - b.y),
    right: new TinyQueue([], (a, b) => a.y - b.y),
    top: new TinyQueue([], (a, b) => a.x - b.x),
    bottom: new TinyQueue([], (a, b) => a.x - b.x)
  };

  for (let i = 0; i < numOfVerticies; i++) {
    const x = vertices[i * 2];
    const y = vertices[i * 2 + 1];
    const pixelIdx = y * gridSize + x;
    const z = terrain[pixelIdx];

    if (skirt) {
      const vertexObj = {x, y, z, vertexIdx: i}
      // Separate if clauses so that corners are included on each edge
      if (x === 0) edges.left.push(vertexObj);
      if (x === 1) edges.right.push(vertexObj);
      if (y === 0) edges.top.push(vertexObj);
      if (y === 1) edges.bottom.push(vertexObj);
    }

    positions[3 * i + 0] = x * xScale + minX;
    positions[3 * i + 1] = -y * yScale + maxY;
    positions[3 * i + 2] = z;

    texCoords[2 * i + 0] = x / tileSize;
    texCoords[2 * i + 1] = y / tileSize;
  }

  if (skirtHeight) {
    const skirted = createSkirt(edges, positions, texCoords, skirtHeight, numOfVertices);
    return {
      POSITION: {value: skirted.positions, size: 3},
      TEXCOORD_0: {value: skirted.texCoords, size: 2}
    };
  }

  return {
    POSITION: {value: positions, size: 3},
    TEXCOORD_0: {value: texCoords, size: 2}
    // NORMAL: {}, - optional, but creates the high poly look with lighting
  };
}

// Loop over neighboring positions on each tile edge, creating two new triangles for each pair of positions. For example, on the edge x=0, where y1, y2 are neighboring
//
//  # along existing vertical edge
//  [[0, y1, z1], [0, y2, z2], [0, y1, z1 - skirtHeight]]
//  # along edge formed by previous triangle
//  [[0, y1, z1 - skirtHeight], [0, y2, z2], [0, y2, z2 - skirtHeight]]
// For a 256px tile, there are a max of 15 pairs of neighboring positions on each edge, so this skirt process would add a max of 120 additional triangles (but usually less with martini's optimizations).

// Return actual total number of skirt triangles
function createSkirt(edges, positions, texCoords, skirtHeight, numOfVertices) {
  let nTriangles = 0;

  // Loop over each edge
  for (const edge in edges) {
    const queue = edges[edge];
    nTriangles += (queue.length - 1) * 2;
  }

  // filter positions, texCoords by actual number of triangles created
  return {
    positions: positions.subarray(0, (numOfVertices + nTriangles) * 3),
    texCoords: texCoords.subarray(0, (numOfVertices + nTriangles) * 2)
  };
}

function getMartiniTileMesh(terrainImage, terrainOptions) {
  if (terrainImage === null) {
    return null;
  }
  const {meshMaxError, bounds, elevationDecoder, skirt} = terrainOptions;

  const data = terrainImage.data;
  const tileSize = terrainImage.width;
  const gridSize = tileSize + 1;

  const terrain = getTerrain(data, tileSize, elevationDecoder);

  const martini = new Martini(gridSize);
  const tile = martini.createTile(terrain);
  const {vertices, triangles} = tile.getMesh(meshMaxError);

  const attributes = getMeshAttributes(
    vertices,
    terrain,
    tileSize,
    bounds,
    skirt && 2 * meshMaxError
  );

  return {
    // Data return by this loader implementation
    loaderData: {
      header: {}
    },
    header: {
      vertexCount: triangles.length,
      boundingBox: getMeshBoundingBox(attributes)
    },
    mode: 4, // TRIANGLES
    indices: {value: triangles, size: 1},
    attributes
  };
}

export default async function loadTerrain(arrayBuffer, options, context) {
  options.image = options.image || {};
  options.image.type = 'data';
  const image = await context.parse(arrayBuffer, options, options.baseUri);
  // Extend function to support additional mesh generation options (square grid or delatin)
  return getMartiniTileMesh(image, options.terrain);
}

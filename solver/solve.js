(function() {
  var B, BL, BR, Cnk, Cube, D, DB, DBL, DF, DFR, DL, DLF, DR, DRB, F, FL, FR, Include, L, N_FLIP, N_FRtoBR, N_PARITY, N_SLICE1, N_SLICE2, N_TWIST, N_UBtoDF, N_URFtoDLF, N_URtoDF, N_URtoUL, R, U, UB, UBR, UF, UFL, UL, ULB, UR, URF, allMoves1, allMoves2, computeMoveTable, computePruningTable, faceNames, faceNums, factorial, key, max, mergeURtoDF, moveTableParams, nextMoves1, nextMoves2, permutationIndex, pruning, pruningTableParams, rotateLeft, rotateRight, value,
    indexOf = [].indexOf;

  Cube = this.Cube || require('./cube');

  // Centers
  [U, R, F, D, L, B] = [0, 1, 2, 3, 4, 5];

  // Corners
  [URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB] = [0, 1, 2, 3, 4, 5, 6, 7];

  // Edges
  [UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  //# Helpers

  // n choose k, i.e. the binomial coeffiecient
  Cnk = function(n, k) {
    var i, j, s;
    if (n < k) {
      return 0;
    }
    if (k > n / 2) {
      k = n - k;
    }
    s = 1;
    i = n;
    j = 1;
    while (i !== n - k) {
      s *= i;
      s /= j;
      i--;
      j++;
    }
    return s;
  };

  // n!
  factorial = function(n) {
    var f, i, m, ref;
    f = 1;
    for (i = m = 2, ref = n; (2 <= ref ? m <= ref : m >= ref); i = 2 <= ref ? ++m : --m) {
      f *= i;
    }
    return f;
  };

  // Maximum of two values
  max = function(a, b) {
    if (a > b) {
      return a;
    } else {
      return b;
    }
  };

  // Rotate elements between l and r left by one place
  rotateLeft = function(array, l, r) {
    var i, m, ref, ref1, tmp;
    tmp = array[l];
    for (i = m = ref = l, ref1 = r - 1; (ref <= ref1 ? m <= ref1 : m >= ref1); i = ref <= ref1 ? ++m : --m) {
      array[i] = array[i + 1];
    }
    return array[r] = tmp;
  };

  // Rotate elements between l and r right by one place
  rotateRight = function(array, l, r) {
    var i, m, ref, ref1, tmp;
    tmp = array[r];
    for (i = m = ref = r, ref1 = l + 1; (ref <= ref1 ? m <= ref1 : m >= ref1); i = ref <= ref1 ? ++m : --m) {
      array[i] = array[i - 1];
    }
    return array[l] = tmp;
  };

  // Generate a function that computes permutation indices.

  // The permutation index actually encodes two indices: Combination,
  // i.e. positions of the cubies start..end (A) and their respective
  // permutation (B). The maximum value for B is

  //   maxB = (end - start + 1)!

  // and the index is A * maxB + B
  permutationIndex = function(context, start, end, fromEnd = false) {
    var i, maxAll, maxB, maxOur, our, permName;
    maxOur = end - start;
    maxB = factorial(maxOur + 1);
    if (context === 'corners') {
      maxAll = 7;
      permName = 'cp';
    } else {
      maxAll = 11;
      permName = 'ep';
    }
    our = (function() {
      var m, ref, results;
      results = [];
      for (i = m = 0, ref = maxOur; (0 <= ref ? m <= ref : m >= ref); i = 0 <= ref ? ++m : --m) {
        results.push(0);
      }
      return results;
    })();
    return function(index) {
      var a, b, c, j, k, m, o, p, perm, q, ref, ref1, ref10, ref2, ref3, ref4, ref5, ref6, ref7, ref8, ref9, t, u, w, x, y, z;
      if (index != null) {
        for (i = m = 0, ref = maxOur; (0 <= ref ? m <= ref : m >= ref); i = 0 <= ref ? ++m : --m) {
          // Reset our to [start..end]
          our[i] = i + start;
        }
        b = index % maxB; // permutation
        a = index / maxB | 0; // combination
        
        // Invalidate all edges
        perm = this[permName];
        for (i = o = 0, ref1 = maxAll; (0 <= ref1 ? o <= ref1 : o >= ref1); i = 0 <= ref1 ? ++o : --o) {
          perm[i] = -1;
        }
// Generate permutation from index b
        for (j = p = 1, ref2 = maxOur; (1 <= ref2 ? p <= ref2 : p >= ref2); j = 1 <= ref2 ? ++p : --p) {
          k = b % (j + 1);
          b = b / (j + 1) | 0;
          // TODO: Implement rotateRightBy(our, 0, j, k)
          while (k > 0) {
            rotateRight(our, 0, j);
            k--;
          }
        }
        // Generate combination and set our edges
        x = maxOur;
        if (fromEnd) {
          for (j = q = 0, ref3 = maxAll; (0 <= ref3 ? q <= ref3 : q >= ref3); j = 0 <= ref3 ? ++q : --q) {
            c = Cnk(maxAll - j, x + 1);
            if (a - c >= 0) {
              perm[j] = our[maxOur - x];
              a -= c;
              x--;
            }
          }
        } else {
          for (j = t = ref4 = maxAll; (ref4 <= 0 ? t <= 0 : t >= 0); j = ref4 <= 0 ? ++t : --t) {
            c = Cnk(j, x + 1);
            if (a - c >= 0) {
              perm[j] = our[x];
              a -= c;
              x--;
            }
          }
        }
        return this;
      } else {
        perm = this[permName];
        for (i = u = 0, ref5 = maxOur; (0 <= ref5 ? u <= ref5 : u >= ref5); i = 0 <= ref5 ? ++u : --u) {
          our[i] = -1;
        }
        a = b = x = 0;
        // Compute the index a < ((maxAll + 1) choose (maxOur + 1)) and
        // the permutation
        if (fromEnd) {
          for (j = w = ref6 = maxAll; (ref6 <= 0 ? w <= 0 : w >= 0); j = ref6 <= 0 ? ++w : --w) {
            if ((start <= (ref7 = perm[j]) && ref7 <= end)) {
              a += Cnk(maxAll - j, x + 1);
              our[maxOur - x] = perm[j];
              x++;
            }
          }
        } else {
          for (j = y = 0, ref8 = maxAll; (0 <= ref8 ? y <= ref8 : y >= ref8); j = 0 <= ref8 ? ++y : --y) {
            if ((start <= (ref9 = perm[j]) && ref9 <= end)) {
              a += Cnk(j, x + 1);
              our[x] = perm[j];
              x++;
            }
          }
        }
// Compute the index b < (maxOur + 1)! for the permutation
        for (j = z = ref10 = maxOur; (ref10 <= 0 ? z <= 0 : z >= 0); j = ref10 <= 0 ? ++z : --z) {
          k = 0;
          while (our[j] !== start + j) {
            rotateLeft(our, 0, j);
            k++;
          }
          b = (j + 1) * b + k;
        }
        return a * maxB + b;
      }
    };
  };

  Include = {
    // The twist of the 8 corners, 0 <= twist < 3^7. The orientation of
    // the DRB corner is fully determined by the orientation of the other
    // corners.
    twist: function(twist) {
      var i, m, o, ori, parity, v;
      if (twist != null) {
        parity = 0;
        for (i = m = 6; m >= 0; i = --m) {
          ori = twist % 3;
          twist = (twist / 3) | 0;
          this.co[i] = ori;
          parity += ori;
        }
        this.co[7] = (3 - parity % 3) % 3;
        return this;
      } else {
        v = 0;
        for (i = o = 0; o <= 6; i = ++o) {
          v = 3 * v + this.co[i];
        }
        return v;
      }
    },
    // The flip of the 12 edges, 0 <= flip < 2^11. The orientation of the
    // BR edge is fully determined by the orientation of the other edges.
    flip: function(flip) {
      var i, m, o, ori, parity, v;
      if (flip != null) {
        parity = 0;
        for (i = m = 10; m >= 0; i = --m) {
          ori = flip % 2;
          flip = flip / 2 | 0;
          this.eo[i] = ori;
          parity += ori;
        }
        this.eo[11] = (2 - parity % 2) % 2;
        return this;
      } else {
        v = 0;
        for (i = o = 0; o <= 10; i = ++o) {
          v = 2 * v + this.eo[i];
        }
        return v;
      }
    },
    // Parity of the corner permutation
    cornerParity: function() {
      var i, j, m, o, ref, ref1, ref2, ref3, s;
      s = 0;
      for (i = m = ref = DRB, ref1 = URF + 1; (ref <= ref1 ? m <= ref1 : m >= ref1); i = ref <= ref1 ? ++m : --m) {
        for (j = o = ref2 = i - 1, ref3 = URF; (ref2 <= ref3 ? o <= ref3 : o >= ref3); j = ref2 <= ref3 ? ++o : --o) {
          if (this.cp[j] > this.cp[i]) {
            s++;
          }
        }
      }
      return s % 2;
    },
    // Parity of the edges permutation. Parity of corners and edges are
    // the same if the cube is solvable.
    edgeParity: function() {
      var i, j, m, o, ref, ref1, ref2, ref3, s;
      s = 0;
      for (i = m = ref = BR, ref1 = UR + 1; (ref <= ref1 ? m <= ref1 : m >= ref1); i = ref <= ref1 ? ++m : --m) {
        for (j = o = ref2 = i - 1, ref3 = UR; (ref2 <= ref3 ? o <= ref3 : o >= ref3); j = ref2 <= ref3 ? ++o : --o) {
          if (this.ep[j] > this.ep[i]) {
            s++;
          }
        }
      }
      return s % 2;
    },
    // Permutation of the six corners URF, UFL, ULB, UBR, DFR, DLF
    URFtoDLF: permutationIndex('corners', URF, DLF),
    // Permutation of the three edges UR, UF, UL
    URtoUL: permutationIndex('edges', UR, UL),
    // Permutation of the three edges UB, DR, DF
    UBtoDF: permutationIndex('edges', UB, DF),
    // Permutation of the six edges UR, UF, UL, UB, DR, DF
    URtoDF: permutationIndex('edges', UR, DF),
    // Permutation of the equator slice edges FR, FL, BL and BR
    FRtoBR: permutationIndex('edges', FR, BR, true)
  };

  for (key in Include) {
    value = Include[key];
    Cube.prototype[key] = value;
  }

  // Move tables are flat Int32Arrays with a stride of 18: the entry for
  // coordinate i after move m lives at index i * 18 + m. Flat typed arrays
  // keep the hot search loops free of nested array dereferences.
  computeMoveTable = function(context, coord, size) {
    var apply, cube, i, j, k, move, table;
    // Loop through all valid values for the coordinate, setting cube's
    // state in each iteration. Then apply each of the 18 moves to the
    // cube, and compute the resulting coordinate.
    apply = context === 'corners' ? 'cornerMultiply' : 'edgeMultiply';
    cube = new Cube;
    table = new Int32Array(size * 18);
    for (i = 0; i < size; i++) {
      cube[coord](i);
      for (j = 0; j <= 5; j++) {
        move = Cube.moves[j];
        for (k = 0; k <= 2; k++) {
          cube[apply](move);
          table[i * 18 + j * 3 + k] = cube[coord]();
        }
        // 4th face turn restores the cube
        cube[apply](move);
      }
    }
    return table;
  };

  // Because we only have the phase 2 URtoDF coordinates, we need to
  // merge the URtoUL and UBtoDF coordinates to URtoDF in the beginning
  // of phase 2.
  mergeURtoDF = (function() {
    var a, b;
    a = new Cube;
    b = new Cube;
    return function(URtoUL, UBtoDF) {
      var i, m;
      // Collisions can be found because unset are set to -1
      a.URtoUL(URtoUL);
      b.UBtoDF(UBtoDF);
      for (i = m = 0; m <= 7; i = ++m) {
        if (a.ep[i] !== -1) {
          if (b.ep[i] !== -1) {
            return -1; // collision
          } else {
            b.ep[i] = a.ep[i];
          }
        }
      }
      return b.URtoDF();
    };
  })();

  N_TWIST = 2187; // 3^7 corner orientations

  N_FLIP = 2048; // 2^11 possible edge flips

  N_PARITY = 2; // 2 possible parities

  N_FRtoBR = 11880; // 12!/(12-4)! permutations of FR..BR edges

  N_SLICE1 = 495; // (12 choose 4) possible positions of FR..BR edges

  N_SLICE2 = 24; // 4! permutations of FR..BR edges in phase 2

  N_URFtoDLF = 20160; // 8!/(8-6)! permutations of URF..DLF corners

  
  // The URtoDF move table is only computed for phase 2 because the full
  // table would have >650000 entries
  N_URtoDF = 20160; // 8!/(8-6)! permutation of UR..DF edges in phase 2

  N_URtoUL = 1320; // 12!/(12-3)! permutations of UR..UL edges

  N_UBtoDF = 1320; // 12!/(12-3)! permutations of UB..DF edges

  
  // The move table for parity is so small that it's included here
  Cube.moveTables = {
    parity: Int32Array.from([1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    twist: null,
    flip: null,
    FRtoBR: null,
    URFtoDLF: null,
    URtoDF: null,
    URtoUL: null,
    UBtoDF: null,
    mergeURtoDF: null,
    // The slice coordinate (FRtoBR / 24) gets its own table so the search
    // does not have to expand it through FRtoBR on every node.
    slice: null
  };

  // Other move tables are computed on the fly
  moveTableParams = {
    // name: [scope, size]
    twist: ['corners', N_TWIST],
    flip: ['edges', N_FLIP],
    FRtoBR: ['edges', N_FRtoBR],
    URFtoDLF: ['corners', N_URFtoDLF],
    URtoDF: ['edges', N_URtoDF],
    URtoUL: ['edges', N_URtoUL],
    UBtoDF: ['edges', N_UBtoDF],
    mergeURtoDF: []
  };

  Cube.computeMoveTables = function(...tables) {
    var len, m, name, scope, size, tableName;
    if (tables.length === 0) {
      tables = (function() {
        var results;
        results = [];
        for (name in moveTableParams) {
          results.push(name);
        }
        return results;
      })();
    }
    for (m = 0, len = tables.length; m < len; m++) {
      tableName = tables[m];
      if (this.moveTables[tableName] !== null) {
        // Already computed
        continue;
      }
      if (tableName === 'mergeURtoDF') {
        this.moveTables.mergeURtoDF = (function() {
          var UBtoDF, URtoUL, merged;
          // Flat with a stride of 336: merged coordinate for the pair
          // (URtoUL, UBtoDF) lives at URtoUL * 336 + UBtoDF.
          merged = new Int32Array(336 * 336);
          for (URtoUL = 0; URtoUL <= 335; URtoUL++) {
            for (UBtoDF = 0; UBtoDF <= 335; UBtoDF++) {
              merged[URtoUL * 336 + UBtoDF] = mergeURtoDF(URtoUL, UBtoDF);
            }
          }
          return merged;
        })();
      } else {
        [scope, size] = moveTableParams[tableName];
        this.moveTables[tableName] = computeMoveTable(scope, tableName, size);
        if (tableName === 'FRtoBR') {
          this.moveTables.slice = (function(FRtoBR) {
            var move, slice, table;
            table = new Int32Array(N_SLICE1 * 18);
            for (slice = 0; slice < N_SLICE1; slice++) {
              for (move = 0; move < 18; move++) {
                table[slice * 18 + move] = FRtoBR[slice * N_SLICE2 * 18 + move] / N_SLICE2 | 0;
              }
            }
            return table;
          })(this.moveTables.FRtoBR);
        }
      }
    }
    return this;
  };

  // Phase 1: All moves are valid
  allMoves1 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  // The list of next valid phase 1 moves when the given face was turned
  // in the last move
  nextMoves1 = (function() {
    var face, lastFace, m, next, o, p, power, results;
    results = [];
    for (lastFace = m = 0; m <= 5; lastFace = ++m) {
      next = [];
// Don't allow commuting moves, e.g. U U'. Also make sure that
// opposite faces are always moved in the same order, i.e. allow
// U D but no D U. This avoids sequences like U D U'.
      for (face = o = 0; o <= 5; face = ++o) {
        if (face !== lastFace && face !== lastFace - 3) {
// single, double or inverse move
          for (power = p = 0; p <= 2; power = ++p) {
            next.push(face * 3 + power);
          }
        }
      }
      results.push(next);
    }
    return results;
  })();

  // Phase 2: Double moves of all faces plus quarter moves of U and D
  allMoves2 = [0, 1, 2, 4, 7, 9, 10, 11, 13, 16];

  nextMoves2 = (function() {
    var face, lastFace, len, m, next, o, p, power, powers, results;
    results = [];
    for (lastFace = m = 0; m <= 5; lastFace = ++m) {
      next = [];
      for (face = o = 0; o <= 5; face = ++o) {
        if (!(face !== lastFace && face !== lastFace - 3)) {
          continue;
        }
        // Allow all moves of U and D and double moves of others
        powers = face === 0 || face === 3 ? [0, 1, 2] : [1];
        for (p = 0, len = powers.length; p < len; p++) {
          power = powers[p];
          next.push(face * 3 + power);
        }
      }
      results.push(next);
    }
    return results;
  })();

  // 8 values are encoded in one 32-bit slot, 4 bits each
  pruning = function(table, index, value) {
    var shift, slot;
    slot = index >> 3;
    shift = (index & 7) << 2;
    if (value != null) {
      // Set
      table[slot] = (table[slot] & ~(0xF << shift)) | (value << shift);
      return value;
    } else {
      // Get
      return (table[slot] >>> shift) & 0xF;
    }
  };

  computePruningTable = function(phase, size, nextIndex) {
    var depth, done, i, index, len, m, move, moves, next, table;
    // Initialize all values to 0xF
    table = new Int32Array(Math.ceil(size / 8));
    table.fill(-1);
    if (phase === 1) {
      moves = allMoves1;
    } else {
      moves = allMoves2;
    }
    depth = 0;
    pruning(table, 0, depth);
    done = 1;
    // In each iteration, take each state found in the previous depth and
    // compute the next state. Stop when all states have been assigned a
    // depth.
    while (done !== size) {
      for (index = 0; index < size; index++) {
        if (((table[index >> 3] >>> ((index & 7) << 2)) & 0xF) !== depth) {
          continue;
        }
        for (i = 0, len = moves.length; i < len; i++) {
          move = moves[i];
          next = nextIndex(index, move);
          if (((table[next >> 3] >>> ((next & 7) << 2)) & 0xF) === 0xF) {
            m = next >> 3;
            table[m] = (table[m] & ~(0xF << ((next & 7) << 2))) | ((depth + 1) << ((next & 7) << 2));
            done++;
          }
        }
      }
      depth++;
    }
    return table;
  };

  Cube.pruningTables = {
    sliceTwist: null,
    sliceFlip: null,
    twistFlip: null,
    sliceURFtoDLFParity: null,
    sliceURtoDFParity: null
  };

  pruningTableParams = {
    // name: [phase, size, nextIndex]
    sliceTwist: [
      1,
      N_SLICE1 * N_TWIST,
      function(index, move) {
        var slice, twist;
        slice = index % N_SLICE1;
        twist = index / N_SLICE1 | 0;
        return Cube.moveTables.twist[twist * 18 + move] * N_SLICE1 + Cube.moveTables.slice[slice * 18 + move];
      }
    ],
    sliceFlip: [
      1,
      N_SLICE1 * N_FLIP,
      function(index, move) {
        var flip, slice;
        slice = index % N_SLICE1;
        flip = index / N_SLICE1 | 0;
        return Cube.moveTables.flip[flip * 18 + move] * N_SLICE1 + Cube.moveTables.slice[slice * 18 + move];
      }
    ],
    // Distance to solving both orientation coordinates at once. This is a
    // third admissible phase-1 bound; combined with the two slice tables it
    // prunes the exact optimal search considerably harder than either
    // orientation bound alone.
    twistFlip: [
      1,
      N_TWIST * N_FLIP,
      function(index, move) {
        var flip, twist;
        flip = index % N_FLIP;
        twist = index / N_FLIP | 0;
        return Cube.moveTables.twist[twist * 18 + move] * N_FLIP + Cube.moveTables.flip[flip * 18 + move];
      }
    ],
    sliceURFtoDLFParity: [
      2,
      N_SLICE2 * N_URFtoDLF * N_PARITY,
      function(index, move) {
        var URFtoDLF, newParity, parity, slice;
        parity = index & 1;
        slice = (index >>> 1) % N_SLICE2;
        URFtoDLF = (index >>> 1) / N_SLICE2 | 0;
        newParity = move % 3 === 1 ? parity : parity ^ 1;
        return (Cube.moveTables.URFtoDLF[URFtoDLF * 18 + move] * N_SLICE2 + Cube.moveTables.FRtoBR[slice * 18 + move]) * 2 + newParity;
      }
    ],
    sliceURtoDFParity: [
      2,
      N_SLICE2 * N_URtoDF * N_PARITY,
      function(index, move) {
        var URtoDF, newParity, parity, slice;
        parity = index & 1;
        slice = (index >>> 1) % N_SLICE2;
        URtoDF = (index >>> 1) / N_SLICE2 | 0;
        newParity = move % 3 === 1 ? parity : parity ^ 1;
        return (Cube.moveTables.URtoDF[URtoDF * 18 + move] * N_SLICE2 + Cube.moveTables.FRtoBR[slice * 18 + move]) * 2 + newParity;
      }
    ]
  };

  Cube.computePruningTables = function(...tables) {
    var len, m, name, params, tableName;
    if (tables.length === 0) {
      tables = (function() {
        var results;
        results = [];
        for (name in pruningTableParams) {
          results.push(name);
        }
        return results;
      })();
    }
    for (m = 0, len = tables.length; m < len; m++) {
      tableName = tables[m];
      if (this.pruningTables[tableName] !== null) {
        // Already computed
        continue;
      }
      params = pruningTableParams[tableName];
      this.pruningTables[tableName] = computePruningTable(...params);
    }
    return this;
  };

  Cube.initSolver = function() {
    Cube.computeMoveTables();
    return Cube.computePruningTables();
  };

  Cube.prototype.solveUpright = function(maxDepth = 22) {
    var State, freeStates, moveNames, phase1, phase1search, phase2, phase2search, solution, state, x;
    // Names for all moves, i.e. U, U2, U', F, F2, ...
    moveNames = (function() {
      var face, faceName, m, o, power, powerName, result;
      faceName = ['U', 'R', 'F', 'D', 'L', 'B'];
      powerName = ['', '2', "'"];
      result = [];
      for (face = m = 0; m <= 5; face = ++m) {
        for (power = o = 0; o <= 2; power = ++o) {
          result.push(faceName[face] + powerName[power]);
        }
      }
      return result;
    })();
    State = class State {
      constructor(cube) {
        this.parent = null;
        this.lastMove = null;
        this.depth = 0;
        if (cube) {
          this.init(cube);
        }
      }

      init(cube) {
        // Phase 1 coordinates
        this.flip = cube.flip();
        this.twist = cube.twist();
        this.slice = cube.FRtoBR() / N_SLICE2 | 0;
        // Phase 2 coordinates
        this.parity = cube.cornerParity();
        this.URFtoDLF = cube.URFtoDLF();
        this.FRtoBR = cube.FRtoBR();
        // These are later merged to URtoDF when phase 2 begins
        this.URtoUL = cube.URtoUL();
        this.UBtoDF = cube.UBtoDF();
        return this;
      }

      solution() {
        if (this.parent) {
          return this.parent.solution() + moveNames[this.lastMove] + ' ';
        } else {
          return '';
        }
      }

      //# Helpers
      move(table, index, move) {
        return Cube.moveTables[table][index * 18 + move];
      }

      pruning(table, index) {
        return pruning(Cube.pruningTables[table], index);
      }

      //# Phase 1

      // Return the next valid phase 1 moves for this state
      moves1() {
        if (this.lastMove !== null) {
          return nextMoves1[this.lastMove / 3 | 0];
        } else {
          return allMoves1;
        }
      }

      // Compute the minimum number of moves to the end of phase 1
      minDist1() {
        var d1, d2;
        // The maximum number of moves to the end of phase 1 wrt. the
        // combination flip and slice coordinates only
        d1 = this.pruning('sliceFlip', N_SLICE1 * this.flip + this.slice);
        // The combination of twist and slice coordinates
        d2 = this.pruning('sliceTwist', N_SLICE1 * this.twist + this.slice);
        // The true minimal distance is the maximum of these two
        return max(d1, d2);
      }

      // Compute the next phase 1 state for the given move
      next1(move) {
        var next;
        next = freeStates.pop();
        next.parent = this;
        next.lastMove = move;
        next.depth = this.depth + 1;
        next.flip = this.move('flip', this.flip, move);
        next.twist = this.move('twist', this.twist, move);
        next.slice = this.move('slice', this.slice, move);
        return next;
      }

      //# Phase 2

      // Return the next valid phase 2 moves for this state
      moves2() {
        if (this.lastMove !== null) {
          return nextMoves2[this.lastMove / 3 | 0];
        } else {
          return allMoves2;
        }
      }

      // Compute the minimum number of moves to the solved cube
      minDist2() {
        var d1, d2, index1, index2;
        index1 = (N_SLICE2 * this.URtoDF + this.FRtoBR) * N_PARITY + this.parity;
        d1 = this.pruning('sliceURtoDFParity', index1);
        index2 = (N_SLICE2 * this.URFtoDLF + this.FRtoBR) * N_PARITY + this.parity;
        d2 = this.pruning('sliceURFtoDLFParity', index2);
        return max(d1, d2);
      }

      // Initialize phase 2 coordinates
      init2(top = true) {
        if (this.parent === null) {
          return;
        }
        // For other states, the phase 2 state is computed based on
        // parent's state.
        // Already assigned for the initial state
        this.parent.init2(false);
        this.URFtoDLF = this.move('URFtoDLF', this.parent.URFtoDLF, this.lastMove);
        this.FRtoBR = this.move('FRtoBR', this.parent.FRtoBR, this.lastMove);
        this.parity = this.move('parity', this.parent.parity, this.lastMove);
        this.URtoUL = this.move('URtoUL', this.parent.URtoUL, this.lastMove);
        this.UBtoDF = this.move('UBtoDF', this.parent.UBtoDF, this.lastMove);
        if (top) {
          // This is the initial phase 2 state. Get the URtoDF coordinate
          // by merging URtoUL and UBtoDF
          return this.URtoDF = Cube.moveTables.mergeURtoDF[this.URtoUL * 336 + this.UBtoDF];
        }
      }

      // Compute the next phase 2 state for the given move
      next2(move) {
        var next;
        next = freeStates.pop();
        next.parent = this;
        next.lastMove = move;
        next.depth = this.depth + 1;
        next.URFtoDLF = this.move('URFtoDLF', this.URFtoDLF, move);
        next.FRtoBR = this.move('FRtoBR', this.FRtoBR, move);
        next.parity = this.move('parity', this.parity, move);
        next.URtoDF = this.move('URtoDF', this.URtoDF, move);
        return next;
      }

    };
    solution = null;
    phase1search = function(state) {
      var depth, m, ref, results;
      depth = 0;
      results = [];
      for (depth = m = 1, ref = maxDepth; (1 <= ref ? m <= ref : m >= ref); depth = 1 <= ref ? ++m : --m) {
        phase1(state, depth);
        if (solution !== null) {
          break;
        }
        results.push(depth++);
      }
      return results;
    };
    phase1 = function(state, depth) {
      var len, m, move, next, ref, ref1, results;
      if (depth === 0) {
        if (state.minDist1() === 0) {
          // Make sure we don't start phase 2 with a phase 2 move as the
          // last move in phase 1, because phase 2 would then repeat the
          // same move.
          if (state.lastMove === null || (ref = state.lastMove, indexOf.call(allMoves2, ref) < 0)) {
            return phase2search(state);
          }
        }
      } else if (depth > 0) {
        if (state.minDist1() <= depth) {
          ref1 = state.moves1();
          results = [];
          for (m = 0, len = ref1.length; m < len; m++) {
            move = ref1[m];
            next = state.next1(move);
            phase1(next, depth - 1);
            freeStates.push(next);
            if (solution !== null) {
              break;
            } else {
              results.push(void 0);
            }
          }
          return results;
        }
      }
    };
    phase2search = function(state) {
      var depth, m, ref, results;
      // Initialize phase 2 coordinates
      state.init2();
      results = [];
      for (depth = m = 1, ref = maxDepth - state.depth; (1 <= ref ? m <= ref : m >= ref); depth = 1 <= ref ? ++m : --m) {
        phase2(state, depth);
        if (solution !== null) {
          break;
        }
        results.push(depth++);
      }
      return results;
    };
    phase2 = function(state, depth) {
      var len, m, move, next, ref, results;
      if (depth === 0) {
        if (state.minDist2() === 0) {
          return solution = state.solution();
        }
      } else if (depth > 0) {
        if (state.minDist2() <= depth) {
          ref = state.moves2();
          results = [];
          for (m = 0, len = ref.length; m < len; m++) {
            move = ref[m];
            next = state.next2(move);
            phase2(next, depth - 1);
            freeStates.push(next);
            if (solution !== null) {
              break;
            } else {
              results.push(void 0);
            }
          }
          return results;
        }
      }
    };
    freeStates = (function() {
      var m, ref, results;
      results = [];
      for (x = m = 0, ref = maxDepth + 1; (0 <= ref ? m <= ref : m >= ref); x = 0 <= ref ? ++m : --m) {
        results.push(new State);
      }
      return results;
    })();
    state = freeStates.pop().init(this);
    phase1search(state);
    freeStates.push(state);
    // Trim the trailing space
    if (solution.length > 0) {
      solution = solution.substring(0, solution.length - 1);
    }
    return solution;
  };


  // Find a provably shortest solution in the half-turn metric (HTM).
  //
  // The regular two-phase solver is first used to establish a short upper
  // bound. We then search complete move trees at increasing total depths.
  // The phase-1 pruning tables provide an admissible lower bound for every
  // state. Whenever a node is in the phase-2 subgroup, an exact phase-2
  // search checks every canonical subgroup suffix that fits the remaining
  // depth. Because unrestricted phase-1 search continues as well, solutions
  // that leave and later re-enter the subgroup are not missed.
  Cube.prototype.solveOptimalUpright = function(options) {
    var FRtoBRMove, UBtoDFMove, URFtoDLFMove, URtoDFMove, URtoULMove, axisCubes, axisMove1, axisMove2,
      conjugateCube, flipMove, i, isMove2, lastDepth, lowerBound, maxDepth, mergeTable, moveNames, moveStack,
      nodes, onProgress, phase2Search, pruneSliceFlip, pruneSliceTwist, pruneTwistFlip, pruneP2URFtoDLF,
      pruneP2URtoDF, quickLength, quickSolution, reportEvery, rootDist, rootFlip, rootTwist, rootSlice,
      search1, searchStarted, sliceMove, solution, solutionLength, tokens, totalDepth, twistMove;

    options = options || {};
    maxDepth = options.maxDepth == null ? 20 : options.maxDepth;
    onProgress = typeof options.onProgress === 'function' ? options.onProgress : function() {};
    reportEvery = options.reportEvery == null ? 500000 : Math.max(1000, options.reportEvery);

    moveNames = (function() {
      var face, faceName, m, o, power, powerName, result;
      faceName = ['U', 'R', 'F', 'D', 'L', 'B'];
      powerName = ['', '2', "'"];
      result = [];
      for (face = m = 0; m <= 5; face = ++m) {
        for (power = o = 0; o <= 2; power = ++o) {
          result.push(faceName[face] + powerName[power]);
        }
      }
      return result;
    })();

    // Evaluate the phase-1 lower bound in three conjugate coordinate
    // systems (UD, FB and RL axes). Each is admissible in HTM, and taking
    // their maximum substantially reduces the exact search tree.
    // axisMove1/axisMove2 translate a move into the x- and z-conjugated
    // coordinate systems.
    axisMove1 = new Int32Array(18);
    axisMove2 = new Int32Array(18);
    (function() {
      var faceMap1, faceMap2, move;
      faceMap1 = [5, 1, 0, 2, 4, 3]; // conjugation by x
      faceMap2 = [1, 3, 2, 4, 0, 5]; // conjugation by z
      for (move = 0; move < 18; move++) {
        axisMove1[move] = faceMap1[move / 3 | 0] * 3 + move % 3;
        axisMove2[move] = faceMap2[move / 3 | 0] * 3 + move % 3;
      }
    })();
    conjugateCube = function(cube, rotation) {
      return new Cube().move(Cube.inverse(rotation)).multiply(cube).move(rotation);
    };

    if (this.isSolved()) {
      return {
        algorithm: '',
        optimalLength: 0,
        quickLength: 0,
        nodes: 0,
        elapsedMs: 0,
        searchedThrough: 0
      };
    }

    onProgress({ stage: 'upper-bound', message: 'Finding a short solution to use as an upper bound…' });
    quickSolution = this.solveUpright(Math.max(24, maxDepth));
    if (quickSolution == null) {
      throw new Error('Could not establish an initial solution bound.');
    }
    quickLength = quickSolution.trim() ? quickSolution.trim().split(/\s+/).length : 0;
    if (quickLength === 0) {
      return {
        algorithm: '',
        optimalLength: 0,
        quickLength: 0,
        nodes: 0,
        elapsedMs: 0,
        searchedThrough: 0
      };
    }

    // Local aliases so the hot loops hit monomorphic typed arrays directly.
    flipMove = Cube.moveTables.flip;
    twistMove = Cube.moveTables.twist;
    sliceMove = Cube.moveTables.slice;
    FRtoBRMove = Cube.moveTables.FRtoBR;
    URFtoDLFMove = Cube.moveTables.URFtoDLF;
    URtoDFMove = Cube.moveTables.URtoDF;
    URtoULMove = Cube.moveTables.URtoUL;
    UBtoDFMove = Cube.moveTables.UBtoDF;
    mergeTable = Cube.moveTables.mergeURtoDF;
    pruneSliceFlip = Cube.pruningTables.sliceFlip;
    pruneSliceTwist = Cube.pruningTables.sliceTwist;
    pruneTwistFlip = Cube.pruningTables.twistFlip;
    pruneP2URtoDF = Cube.pruningTables.sliceURtoDFParity;
    pruneP2URFtoDLF = Cube.pruningTables.sliceURFtoDLFParity;

    isMove2 = new Uint8Array(18);
    for (i = 0; i < allMoves2.length; i++) {
      isMove2[allMoves2[i]] = 1;
    }

    moveStack = new Int32Array(Math.max(maxDepth, quickLength) + 2);
    nodes = 0;
    solutionLength = -1;
    searchStarted = Date.now();

    // Exhaustive search of the phase-2 subgroup for a solution of exactly
    // `remaining` more moves. All coordinates are plain integers; the chosen
    // move at each level is recorded in moveStack.
    phase2Search = function(URtoDF, FRtoBR, URFtoDLF, parity, lastMove, remaining, depth) {
      var d1, m, moves, n;
      nodes++;
      if (nodes % reportEvery === 0) {
        onProgress({
          stage: 'proof-search',
          depth: totalDepth,
          upperBound: quickLength,
          nodes: nodes,
          elapsedMs: Date.now() - searchStarted
        });
      }
      d1 = (pruneP2URtoDF[((URtoDF * 24 + FRtoBR) * 2 + parity) >> 3] >>> ((((URtoDF * 24 + FRtoBR) * 2 + parity) & 7) << 2)) & 0xF;
      if (d1 > remaining) {
        return false;
      }
      n = (URFtoDLF * 24 + FRtoBR) * 2 + parity;
      if (((pruneP2URFtoDLF[n >> 3] >>> ((n & 7) << 2)) & 0xF) > remaining) {
        return false;
      }
      if (remaining === 0) {
        // Both pruning distances are zero only for the solved state.
        if (d1 === 0 && ((pruneP2URFtoDLF[n >> 3] >>> ((n & 7) << 2)) & 0xF) === 0) {
          solutionLength = depth;
          return true;
        }
        return false;
      }
      moves = lastMove < 0 ? allMoves2 : nextMoves2[lastMove / 3 | 0];
      for (var im = 0; im < moves.length; im++) {
        m = moves[im];
        moveStack[depth] = m;
        if (phase2Search(
          URtoDFMove[URtoDF * 18 + m],
          FRtoBRMove[FRtoBR * 18 + m],
          URFtoDLFMove[URFtoDLF * 18 + m],
          m % 3 === 1 ? parity : parity ^ 1,
          m, remaining - 1, depth + 1
        )) {
          return true;
        }
      }
      return false;
    };

    // Depth-limited exhaustive search over the full move group. Children are
    // pruned before recursing: their phase-1 coordinates are computed first
    // and the remaining coordinates only when every admissible bound fits
    // within the remaining depth.
    search1 = function(f0, t0, s0, f1, t1, s1, f2, t2, s2, FRtoBR, parity, URFtoDLF, URtoUL, UBtoDF, lastMove, remaining, depth) {
      var idx, m, m1, m2, merged, moves, nf0, nf1, nf2, ns0, ns1, ns2, nt0, nt1, nt2, rem;
      nodes++;
      if (nodes % reportEvery === 0) {
        onProgress({
          stage: 'proof-search',
          depth: totalDepth,
          upperBound: quickLength,
          nodes: nodes,
          elapsedMs: Date.now() - searchStarted
        });
      }
      if ((f0 | t0 | s0) === 0 && (lastMove < 0 || isMove2[lastMove] === 0)) {
        // The state is inside the phase-2 subgroup and was not reached by a
        // phase-2 move (in that case the parent, also inside the subgroup,
        // already searched the identical subgroup suffixes). Check every
        // canonical subgroup suffix that fits the remaining depth. The
        // unrestricted search below still continues, so solutions that
        // leave and re-enter the subgroup are not missed.
        merged = mergeTable[URtoUL * 336 + UBtoDF];
        if (merged >= 0 && phase2Search(merged, FRtoBR, URFtoDLF, parity, lastMove, remaining, depth)) {
          return true;
        }
      }
      if (remaining === 0) {
        return false;
      }
      rem = remaining - 1;
      moves = lastMove < 0 ? allMoves1 : nextMoves1[lastMove / 3 | 0];
      for (var im = 0; im < moves.length; im++) {
        m = moves[im];
        nf0 = flipMove[f0 * 18 + m];
        nt0 = twistMove[t0 * 18 + m];
        ns0 = sliceMove[s0 * 18 + m];
        idx = nf0 * N_SLICE1 + ns0;
        if (((pruneSliceFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nt0 * N_SLICE1 + ns0;
        if (((pruneSliceTwist[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nt0 * N_FLIP + nf0;
        if (((pruneTwistFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        m1 = axisMove1[m];
        nf1 = flipMove[f1 * 18 + m1];
        nt1 = twistMove[t1 * 18 + m1];
        ns1 = sliceMove[s1 * 18 + m1];
        idx = nf1 * N_SLICE1 + ns1;
        if (((pruneSliceFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nt1 * N_SLICE1 + ns1;
        if (((pruneSliceTwist[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nt1 * N_FLIP + nf1;
        if (((pruneTwistFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        m2 = axisMove2[m];
        nf2 = flipMove[f2 * 18 + m2];
        nt2 = twistMove[t2 * 18 + m2];
        ns2 = sliceMove[s2 * 18 + m2];
        idx = nf2 * N_SLICE1 + ns2;
        if (((pruneSliceFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nt2 * N_SLICE1 + ns2;
        if (((pruneSliceTwist[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nt2 * N_FLIP + nf2;
        if (((pruneTwistFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        moveStack[depth] = m;
        if (search1(
          nf0, nt0, ns0, nf1, nt1, ns1, nf2, nt2, ns2,
          FRtoBRMove[FRtoBR * 18 + m],
          m % 3 === 1 ? parity : parity ^ 1,
          URFtoDLFMove[URFtoDLF * 18 + m],
          URtoULMove[URtoUL * 18 + m],
          UBtoDFMove[UBtoDF * 18 + m],
          m, rem, depth + 1
        )) {
          return true;
        }
      }
      return false;
    };

    axisCubes = [this, conjugateCube(this, 'x'), conjugateCube(this, 'z')];
    rootFlip = [axisCubes[0].flip(), axisCubes[1].flip(), axisCubes[2].flip()];
    rootTwist = [axisCubes[0].twist(), axisCubes[1].twist(), axisCubes[2].twist()];
    rootSlice = [
      axisCubes[0].FRtoBR() / N_SLICE2 | 0,
      axisCubes[1].FRtoBR() / N_SLICE2 | 0,
      axisCubes[2].FRtoBR() / N_SLICE2 | 0
    ];

    // Distance to the phase-2 subgroup is admissible in the full HTM move
    // graph. Phase-2-only distance is not: leaving the subgroup can sometimes
    // create a shorter unrestricted solution, so it must not raise this bound.
    lowerBound = 0;
    for (i = 0; i < 3; i++) {
      rootDist = max(
        pruning(pruneSliceFlip, rootFlip[i] * N_SLICE1 + rootSlice[i]),
        pruning(pruneSliceTwist, rootTwist[i] * N_SLICE1 + rootSlice[i])
      );
      rootDist = max(rootDist, pruning(pruneTwistFlip, rootTwist[i] * N_FLIP + rootFlip[i]));
      lowerBound = max(lowerBound, rootDist);
    }

    // If the quick result is within God's Number, proving every shorter
    // depth is enough. If it is longer, search through depth 20 inclusive;
    // the HTM diameter theorem guarantees a solution by then.
    lastDepth = quickLength <= maxDepth ? quickLength - 1 : maxDepth;

    for (totalDepth = lowerBound; totalDepth <= lastDepth; totalDepth++) {
      onProgress({
        stage: 'proof-search',
        depth: totalDepth,
        upperBound: quickLength,
        nodes: nodes,
        elapsedMs: Date.now() - searchStarted
      });
      if (search1(
        rootFlip[0], rootTwist[0], rootSlice[0],
        rootFlip[1], rootTwist[1], rootSlice[1],
        rootFlip[2], rootTwist[2], rootSlice[2],
        this.FRtoBR(), this.cornerParity(), this.URFtoDLF(), this.URtoUL(), this.UBtoDF(),
        -1, totalDepth, 0
      )) {
        tokens = [];
        for (i = 0; i < solutionLength; i++) {
          tokens.push(moveNames[moveStack[i]]);
        }
        solution = tokens.join(' ');
        return {
          algorithm: solution,
          optimalLength: solutionLength,
          quickLength: quickLength,
          nodes: nodes,
          elapsedMs: Date.now() - searchStarted,
          searchedThrough: totalDepth
        };
      }
    }

    if (quickLength <= maxDepth) {
      return {
        algorithm: quickSolution,
        optimalLength: quickLength,
        quickLength: quickLength,
        nodes: nodes,
        elapsedMs: Date.now() - searchStarted,
        searchedThrough: lastDepth
      };
    }

    throw new Error('No solution was found within 20 HTM moves. This indicates an internal solver error.');
  };


  // Reusable exact-optimal searcher, shared by the single-thread driver above
  // and the parallel worker pool. It holds the phase-1/phase-2 kernel and lets a
  // caller run a *single* total depth, optionally restricting the first plies to
  // a fixed prefix so independent subtrees can be searched on different cores.
  //
  //   searcher = Cube.buildOptimalSearcher(uprightCube, reportEvery, onProgress)
  //   result   = searcher.run(totalDepth, prefix /* [m0, m1] or null */, upperBound)
  //   result -> { found, solutionLength, nodes }
  //
  // When `found`, the move sequence is in searcher.moveStack[0 .. solutionLength).
  // The kernel is a faithful copy of solveOptimalUpright's inner loops; the only
  // differences are (a) the optional root prefix and (b) the admissible pruning
  // checks are ordered strongest-first (twistFlip, then sliceTwist, then
  // sliceFlip) so hopeless branches are rejected a lookup or two sooner. Check
  // order never changes which nodes are pruned, only how quickly.
  var buildOptimalSearcher = function(cube, reportEvery, onProgress) {
    reportEvery = reportEvery == null ? 500000 : Math.max(1000, reportEvery);
    onProgress = typeof onProgress === 'function' ? onProgress : function() {};

    var moveNames = (function() {
      var face, faceName, m, o, power, powerName, result;
      faceName = ['U', 'R', 'F', 'D', 'L', 'B'];
      powerName = ['', '2', "'"];
      result = [];
      for (face = m = 0; m <= 5; face = ++m) {
        for (power = o = 0; o <= 2; power = ++o) {
          result.push(faceName[face] + powerName[power]);
        }
      }
      return result;
    })();

    // Move translation into the x- and z-conjugated coordinate systems, so the
    // phase-1 bound can be evaluated on all three cube axes (UD, FB, RL).
    var axisMove1 = new Int32Array(18);
    var axisMove2 = new Int32Array(18);
    (function() {
      var faceMap1 = [5, 1, 0, 2, 4, 3]; // conjugation by x
      var faceMap2 = [1, 3, 2, 4, 0, 5]; // conjugation by z
      for (var move = 0; move < 18; move++) {
        axisMove1[move] = faceMap1[move / 3 | 0] * 3 + move % 3;
        axisMove2[move] = faceMap2[move / 3 | 0] * 3 + move % 3;
      }
    })();
    var conjugateCube = function(c, rotation) {
      return new Cube().move(Cube.inverse(rotation)).multiply(c).move(rotation);
    };

    var flipMove = Cube.moveTables.flip;
    var twistMove = Cube.moveTables.twist;
    var sliceMove = Cube.moveTables.slice;
    var FRtoBRMove = Cube.moveTables.FRtoBR;
    var URFtoDLFMove = Cube.moveTables.URFtoDLF;
    var URtoDFMove = Cube.moveTables.URtoDF;
    var URtoULMove = Cube.moveTables.URtoUL;
    var UBtoDFMove = Cube.moveTables.UBtoDF;
    var mergeTable = Cube.moveTables.mergeURtoDF;
    var pruneSliceFlip = Cube.pruningTables.sliceFlip;
    var pruneSliceTwist = Cube.pruningTables.sliceTwist;
    var pruneTwistFlip = Cube.pruningTables.twistFlip;
    var pruneP2URtoDF = Cube.pruningTables.sliceURtoDFParity;
    var pruneP2URFtoDLF = Cube.pruningTables.sliceURFtoDLFParity;

    var isMove2 = new Uint8Array(18);
    for (var mi = 0; mi < allMoves2.length; mi++) {
      isMove2[allMoves2[mi]] = 1;
    }

    var axisCubes = [cube, conjugateCube(cube, 'x'), conjugateCube(cube, 'z')];
    var rootFlip = [axisCubes[0].flip(), axisCubes[1].flip(), axisCubes[2].flip()];
    var rootTwist = [axisCubes[0].twist(), axisCubes[1].twist(), axisCubes[2].twist()];
    var rootSlice = [
      axisCubes[0].FRtoBR() / N_SLICE2 | 0,
      axisCubes[1].FRtoBR() / N_SLICE2 | 0,
      axisCubes[2].FRtoBR() / N_SLICE2 | 0
    ];
    var rootFRtoBR = cube.FRtoBR();
    var rootParity = cube.cornerParity();
    var rootURFtoDLF = cube.URFtoDLF();
    var rootURtoUL = cube.URtoUL();
    var rootUBtoDF = cube.UBtoDF();

    // Distance to the phase-2 subgroup, admissible in the full HTM move graph.
    var lowerBound = 0;
    for (var ax = 0; ax < 3; ax++) {
      var rootDist = max(
        pruning(pruneSliceFlip, rootFlip[ax] * N_SLICE1 + rootSlice[ax]),
        pruning(pruneSliceTwist, rootTwist[ax] * N_SLICE1 + rootSlice[ax])
      );
      rootDist = max(rootDist, pruning(pruneTwistFlip, rootTwist[ax] * N_FLIP + rootFlip[ax]));
      lowerBound = max(lowerBound, rootDist);
    }

    var moveStack = new Int32Array(32);
    var nodes = 0;
    var solutionLength = -1;
    var searchStarted = Date.now();
    var totalDepth = 0;
    var upperBound = 0;
    var prefixMoves = null;
    var prefixLen = 0;

    // Exhaustive search of the phase-2 subgroup for a solution of exactly
    // `remaining` more moves.
    var phase2Search = function(URtoDF, FRtoBR, URFtoDLF, parity, lastMove, remaining, depth) {
      var d1, d2, i1, i2, m, moves;
      nodes++;
      if (nodes % reportEvery === 0) {
        onProgress({ stage: 'proof-search', depth: totalDepth, upperBound: upperBound, nodes: nodes, elapsedMs: Date.now() - searchStarted });
      }
      i1 = (URtoDF * 24 + FRtoBR) * 2 + parity;
      d1 = (pruneP2URtoDF[i1 >> 3] >>> ((i1 & 7) << 2)) & 0xF;
      if (d1 > remaining) {
        return false;
      }
      i2 = (URFtoDLF * 24 + FRtoBR) * 2 + parity;
      d2 = (pruneP2URFtoDLF[i2 >> 3] >>> ((i2 & 7) << 2)) & 0xF;
      if (d2 > remaining) {
        return false;
      }
      if (remaining === 0) {
        // Both pruning distances are zero only for the solved state.
        if (d1 === 0 && d2 === 0) {
          solutionLength = depth;
          return true;
        }
        return false;
      }
      moves = lastMove < 0 ? allMoves2 : nextMoves2[lastMove / 3 | 0];
      for (var im = 0; im < moves.length; im++) {
        m = moves[im];
        moveStack[depth] = m;
        if (phase2Search(
          URtoDFMove[URtoDF * 18 + m],
          FRtoBRMove[FRtoBR * 18 + m],
          URFtoDLFMove[URFtoDLF * 18 + m],
          m % 3 === 1 ? parity : parity ^ 1,
          m, remaining - 1, depth + 1
        )) {
          return true;
        }
      }
      return false;
    };

    // Depth-limited exhaustive search over the full move group. If `depth` is
    // still inside the fixed prefix, only the prefix move at that ply is tried.
    var search1 = function(f0, t0, s0, f1, t1, s1, f2, t2, s2, FRtoBR, parity, URFtoDLF, URtoUL, UBtoDF, lastMove, remaining, depth) {
      var idx, m, m1, m2, merged, moves, nf0, nf1, nf2, ns0, ns1, ns2, nt0, nt1, nt2, rem;
      nodes++;
      if (nodes % reportEvery === 0) {
        onProgress({ stage: 'proof-search', depth: totalDepth, upperBound: upperBound, nodes: nodes, elapsedMs: Date.now() - searchStarted });
      }
      if ((f0 | t0 | s0) === 0 && (lastMove < 0 || isMove2[lastMove] === 0)) {
        merged = mergeTable[URtoUL * 336 + UBtoDF];
        if (merged >= 0 && phase2Search(merged, FRtoBR, URFtoDLF, parity, lastMove, remaining, depth)) {
          return true;
        }
      }
      if (remaining === 0) {
        return false;
      }
      rem = remaining - 1;
      if (depth < prefixLen) {
        moves = prefixMoves[depth];
      } else {
        moves = lastMove < 0 ? allMoves1 : nextMoves1[lastMove / 3 | 0];
      }
      for (var im = 0; im < moves.length; im++) {
        m = moves[im];
        nf0 = flipMove[f0 * 18 + m];
        nt0 = twistMove[t0 * 18 + m];
        ns0 = sliceMove[s0 * 18 + m];
        idx = nt0 * N_FLIP + nf0;
        if (((pruneTwistFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nt0 * N_SLICE1 + ns0;
        if (((pruneSliceTwist[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nf0 * N_SLICE1 + ns0;
        if (((pruneSliceFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        m1 = axisMove1[m];
        nf1 = flipMove[f1 * 18 + m1];
        nt1 = twistMove[t1 * 18 + m1];
        ns1 = sliceMove[s1 * 18 + m1];
        idx = nt1 * N_FLIP + nf1;
        if (((pruneTwistFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nt1 * N_SLICE1 + ns1;
        if (((pruneSliceTwist[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nf1 * N_SLICE1 + ns1;
        if (((pruneSliceFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        m2 = axisMove2[m];
        nf2 = flipMove[f2 * 18 + m2];
        nt2 = twistMove[t2 * 18 + m2];
        ns2 = sliceMove[s2 * 18 + m2];
        idx = nt2 * N_FLIP + nf2;
        if (((pruneTwistFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nt2 * N_SLICE1 + ns2;
        if (((pruneSliceTwist[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        idx = nf2 * N_SLICE1 + ns2;
        if (((pruneSliceFlip[idx >> 3] >>> ((idx & 7) << 2)) & 0xF) > rem) {
          continue;
        }
        moveStack[depth] = m;
        if (search1(
          nf0, nt0, ns0, nf1, nt1, ns1, nf2, nt2, ns2,
          FRtoBRMove[FRtoBR * 18 + m],
          m % 3 === 1 ? parity : parity ^ 1,
          URFtoDLFMove[URFtoDLF * 18 + m],
          URtoULMove[URtoUL * 18 + m],
          UBtoDFMove[UBtoDF * 18 + m],
          m, rem, depth + 1
        )) {
          return true;
        }
      }
      return false;
    };

    return {
      lowerBound: lowerBound,
      moveNames: moveNames,
      moveStack: moveStack,
      searchStarted: searchStarted,
      getNodes: function() { return nodes; },
      // Search a single total depth. `prefix` fixes the first plies (used to hand
      // disjoint subtrees to different workers); pass null for the whole tree.
      run: function(depth, prefix, ub) {
        totalDepth = depth;
        upperBound = ub == null ? depth : ub;
        solutionLength = -1;
        if (prefix && prefix.length) {
          prefixLen = prefix.length;
          prefixMoves = [];
          for (var i = 0; i < prefix.length; i++) {
            prefixMoves.push([prefix[i]]);
          }
        } else {
          prefixLen = 0;
          prefixMoves = null;
        }
        var found = search1(
          rootFlip[0], rootTwist[0], rootSlice[0],
          rootFlip[1], rootTwist[1], rootSlice[1],
          rootFlip[2], rootTwist[2], rootSlice[2],
          rootFRtoBR, rootParity, rootURFtoDLF, rootURtoUL, rootUBtoDF,
          -1, depth, 0
        );
        return { found: found, solutionLength: solutionLength, nodes: nodes };
      }
    };
  };

  Cube.buildOptimalSearcher = buildOptimalSearcher;

  // Remap a solution found on the upright cube back into the original scanned
  // orientation. Mirrors the token remapping in solveOptimal below.
  Cube.remapSolution = function(algorithm, rotation) {
    var faceNumsLocal = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
    var faceNamesLocal = { 0: 'U', 1: 'R', 2: 'F', 3: 'D', 4: 'L', 5: 'B' };
    var ref = algorithm.trim() ? algorithm.trim().split(/\s+/) : [];
    var out = [];
    for (var m = 0; m < ref.length; m++) {
      var move = ref[m];
      var mapped = faceNamesLocal[rotation[faceNumsLocal[move[0]]]];
      if (move.length > 1) {
        mapped += move[1];
      }
      out.push(mapped);
    }
    return out.join(' ');
  };

  // Establish the shared, one-time inputs for a parallel optimal search: the
  // upright cube every worker searches, the rotation to map solutions back, a
  // quick two-phase upper bound, the admissible lower bound, and the last depth
  // that must be proven solution-free. Cheap; run once per solve.
  Cube.prototype.optimalPrepare = function(maxDepth) {
    maxDepth = maxDepth == null ? 20 : maxDepth;
    var clone = this.clone();
    var upright = clone.upright();
    clone.move(upright);
    var rotation = new Cube().move(upright).center;
    if (clone.isSolved()) {
      return { solved: true, rotation: rotation, upright: clone.toJSON(), quickLength: 0, quickAlgorithm: '', lowerBound: 0, lastDepth: 0 };
    }
    var quick = clone.solveUpright(Math.max(24, maxDepth));
    if (quick == null) {
      throw new Error('Could not establish an initial solution bound.');
    }
    var quickLength = quick.trim() ? quick.trim().split(/\s+/).length : 0;
    var searcher = buildOptimalSearcher(clone, 500000, null);
    var lowerBound = searcher.lowerBound;
    var lastDepth = quickLength <= maxDepth ? quickLength - 1 : maxDepth;
    return {
      solved: false,
      rotation: rotation,
      upright: clone.toJSON(),
      quickLength: quickLength,
      quickAlgorithm: Cube.remapSolution(quick, rotation),
      lowerBound: lowerBound,
      lastDepth: lastDepth
    };
  };

  faceNums = {
    U: 0,
    R: 1,
    F: 2,
    D: 3,
    L: 4,
    B: 5
  };

  faceNames = {
    0: 'U',
    1: 'R',
    2: 'F',
    3: 'D',
    4: 'L',
    5: 'B'
  };

  Cube.prototype.solve = function(maxDepth = 22) {
    var clone, len, m, move, ref, rotation, solution, upright, uprightSolution;
    clone = this.clone();
    upright = clone.upright();
    clone.move(upright);
    rotation = new Cube().move(upright).center;
    uprightSolution = clone.solveUpright(maxDepth);
    solution = [];
    ref = uprightSolution.split(' ');
    for (m = 0, len = ref.length; m < len; m++) {
      move = ref[m];
      solution.push(faceNames[rotation[faceNums[move[0]]]]);
      if (move.length > 1) {
        solution[solution.length - 1] += move[1];
      }
    }
    return solution.join(' ');
  };


  Cube.prototype.solveOptimal = function(options) {
    var clone, len, m, move, ref, result, rotation, solution, upright;
    clone = this.clone();
    upright = clone.upright();
    clone.move(upright);
    rotation = new Cube().move(upright).center;
    result = clone.solveOptimalUpright(options || {});
    solution = [];
    ref = result.algorithm.trim() ? result.algorithm.trim().split(/\s+/) : [];
    for (m = 0, len = ref.length; m < len; m++) {
      move = ref[m];
      solution.push(faceNames[rotation[faceNums[move[0]]]]);
      if (move.length > 1) {
        solution[solution.length - 1] += move[1];
      }
    }
    result.algorithm = solution.join(' ');
    return result;
  };

  Cube.scramble = function() {
    return Cube.inverse(Cube.random().solve());
  };

}).call(this);

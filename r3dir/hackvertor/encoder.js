// Source: https://github.com/siara-cc/unishox_js/blob/87d4c2b3a5363b24797c7399d4c1afaa060ae808/unishox2.js

/*
 * Copyright (C) 2020 Siara Logics (cc)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author Arundale Ramanathan
 *
 */
 
var USX_HCODES_DFLT = new Uint8Array([0x00, 0x40, 0x80, 0xC0, 0xE0]);
var USX_HCODE_LENS_DFLT = new Uint8Array([2, 2, 2, 3, 3]);
var USX_HCODES_ALPHA_NUM_SYM_ONLY = new Uint8Array([0x00, 0x80, 0xC0, 0x00, 0x00]);
var USX_HCODE_LENS_ALPHA_NUM_SYM_ONLY = new Uint8Array([1, 2, 2, 0, 0]);
var USX_FREQ_SEQ_DFLT = ["\": \"", "\": ", "</", "=\"", "\":\"", "://"];
var USX_TEMPLATES = ["tfff-of-tfTtf:rf:rf.fffZ", "tfff-of-tf", "(fff) fff-ffff", "tf:rf:rf", 0];

const USX_ALPHA = 0;
const USX_SYM = 1;
const USX_NUM = 2;
const USX_DICT = 3;
const USX_DELTA = 4;

var usx_sets = ["\0 etaoinsrlcdhupmbgwfyvkqjxz",
                "\"{}_<>:\n\0[]\\;'\t@*&?!^|\r~`\0\0\0",
                "\0,.01925-/34678() =+$%#\0\0\0\0\0"];

// Stores position of letter in usx_sets.
// First 3 bits - position in usx_hcodes
// Next  5 bits - position in usx_vcodes
var usx_code_94 = new Array(94);

var usx_vcodes = new Uint8Array(
  [ 0x00, 0x40, 0x60, 0x80, 0x90, 0xA0, 0xB0,
    0xC0, 0xD0, 0xD8, 0xE0, 0xE4, 0xE8, 0xEC,
    0xEE, 0xF0, 0xF2, 0xF4, 0xF6, 0xF7, 0xF8,
    0xF9, 0xFA, 0xFB, 0xFC, 0xFD, 0xFE, 0xFF ]);
var usx_vcode_lens = new Uint8Array(
  [  2,    3,    3,    4,    4,    4,    4,
     4,    5,    5,    6,    6,    6,    7,
     7,    7,    7,    7,    8,    8,    8,
     8,    8,    8,    8,    8,    8,    8 ]);

var usx_freq_codes = new Uint8Array([(1 << 5) + 25, (1 << 5) + 26, (1 << 5) + 27, (2 << 5) + 23, (2 << 5) + 24, (2 << 5) + 25]);

var NICE_LEN = 5;

const RPT_CODE = ((2 << 5) + 26);
const TERM_CODE = ((2 << 5) + 27);
const LF_CODE = ((1 << 5) + 7);
const CRLF_CODE = ((1 << 5) + 8);
const CR_CODE = ((1 << 5) + 22);
const TAB_CODE = ((1 << 5) + 14);
const NUM_SPC_CODE = ((2 << 5) + 17);

const UNI_STATE_SPL_CODE = 0xF8;
const UNI_STATE_SPL_CODE_LEN = 5;
const UNI_STATE_SW_CODE = 0x80;
const UNI_STATE_SW_CODE_LEN = 2;

const SW_CODE = 0;
const SW_CODE_LEN = 2;
/// Terminator bit sequence for Preset 1. Length varies depending on state as per following consts
const TERM_BYTE_PRESET_1 = 0;
/// Length of Terminator bit sequence when state is lower
const TERM_BYTE_PRESET_1_LEN_LOWER = 6;
/// Length of Terminator bit sequence when state is upper
const TERM_BYTE_PRESET_1_LEN_UPPER = 4;

const USX_OFFSET_94 = 33;

/// We almost never need the full terminator
const need_full_term_codes = 0;

// From: https://stackoverflow.com/a/24466476/5072621
// Note that size is the number of array elements to set,
// not the number of bytes.
function memset(array, val, size) {
  for (var i = 0; i < size; ++i) {
    array[i] = val;
  }
}

var is_inited = 0;
function init_coder() {
  if (is_inited)
    return;
  memset(usx_code_94, '\0', 94);
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 28; j++) {
      var c = usx_sets[i].charCodeAt(j);
      if (c !== 0 && c > 32) {
        usx_code_94[c - USX_OFFSET_94] = (i << 5) + j;
        if (c >= 97 && c <= 122) // a - z
          usx_code_94[c - USX_OFFSET_94 - (97 - 65)] = (i << 5) + j;
      }
    }
  }
  is_inited = 1;
}

var usx_mask = new Uint8Array([0x80, 0xC0, 0xE0, 0xF0, 0xF8, 0xFC, 0xFE, 0xFF]);
function append_bits(out, olen, ol, code, clen) {

  var cur_bit;
  var blen;
  var a_byte;
  var oidx;

  //console.log(util.format("%d,%x,%d,%d\n", ol, code, clen, state));

  while (clen > 0) {
     cur_bit = ol % 8;
     blen = clen;
     a_byte = code & usx_mask[blen - 1];
     a_byte >>= cur_bit;
     if (blen + cur_bit > 8)
        blen = (8 - cur_bit);
     oidx = ol / 8;
     if (oidx < 0 || olen <= oidx)
        return -1;
     if (cur_bit == 0)
        out[ol >> 3] = a_byte;
     else
        out[ol >> 3] |= a_byte;
     code <<= blen;
     ol += blen;
     clen -= blen;
   }
   return ol;
}

function append_switch_code(out, olen, ol, state) {
  if (state == USX_DELTA) {
    ol = append_bits(out, olen, ol, UNI_STATE_SPL_CODE, UNI_STATE_SPL_CODE_LEN);
    ol = append_bits(out, olen, ol, UNI_STATE_SW_CODE, UNI_STATE_SW_CODE_LEN);
  } else
    ol = append_bits(out, olen, ol, SW_CODE, SW_CODE_LEN);
  return ol;
}

function append_code(out, olen, ol, code, state, usx_hcodes, usx_hcode_lens) {
  var hcode = code >> 5;
  var vcode = code & 0x1F;
  if (usx_hcode_lens[hcode] == 0 && hcode != USX_ALPHA)
    return [ol, state];
  switch (hcode) {
    case USX_ALPHA:
      if (state != USX_ALPHA) {
        ol = append_switch_code(out, olen, ol, state);
        ol = append_bits(out, olen, ol, usx_hcodes[USX_ALPHA], usx_hcode_lens[USX_ALPHA]);
        state = USX_ALPHA;
      }
      break;
    case USX_SYM:
      ol = append_switch_code(out, olen, ol, state);
      ol = append_bits(out, olen, ol, usx_hcodes[USX_SYM], usx_hcode_lens[USX_SYM]);
      break;
    case USX_NUM:
      if (state != USX_NUM) {
        ol = append_switch_code(out, olen, ol, state);
        ol = append_bits(out, olen, ol, usx_hcodes[USX_NUM], usx_hcode_lens[USX_NUM]);
        if (usx_sets[hcode].charCodeAt(vcode) >= 48 && usx_sets[hcode].charCodeAt(vcode) <= 57)
          state = USX_NUM;
      }
  }
  return [append_bits(out, olen, ol, usx_vcodes[vcode], usx_vcode_lens[vcode]), state];
}

const count_bit_lens = new Uint8Array([2, 4, 7, 11, 16]);
const count_adder = [4, 20, 148, 2196, 67732];
// First five bits are code and Last three bits of codes represent length
const count_codes = new Uint8Array([0x01, 0x82, 0xC3, 0xE4, 0xF4]);
function encodeCount(out, olen, ol, count) {
  for (var i = 0; i < 5; i++) {
    if (count < count_adder[i]) {
      ol = append_bits(out, olen, ol, (count_codes[i] & 0xF8), count_codes[i] & 0x07);
      var count16 = (count - (i > 0 ? count_adder[i - 1] : 0)) << (16 - count_bit_lens[i]);
      if (count_bit_lens[i] > 8) {
        ol = append_bits(out, olen, ol, count16 >> 8, 8);
        ol = append_bits(out, olen, ol, count16 & 0xFF, count_bit_lens[i] - 8);
      } else
        ol = append_bits(out, olen, ol, count16 >> 8, count_bit_lens[i]);
      return ol;
    }
  }
  return ol;
}

const uni_bit_len = new Uint8Array([6, 12, 14, 16, 21]);
const uni_adder = [0, 64, 4160, 20544, 86080];

function encodeUnicode(out, olen, ol, code, prev_code) {
  // First five bits are code and Last three bits of codes represent length
  //const byte codes[8] = {0x00, 0x42, 0x83, 0xA3, 0xC3, 0xE4, 0xF5, 0xFD};
  const codes = new Uint8Array([0x01, 0x82, 0xC3, 0xE4, 0xF5, 0xFD]);
  var till = 0;
  var orig_ol = ol;
  var diff = code - prev_code;
  if (diff < 0)
    diff = -diff;
  //printf("%ld, ", code);
  //printf("Diff: %d\n", diff);
  for (var i = 0; i < 5; i++) {
    till += (1 << uni_bit_len[i]);
    if (diff < till) {
      ol = append_bits(out, olen, ol, (codes[i] & 0xF8), codes[i] & 0x07);
      //if (diff) {
        ol = append_bits(out, olen, ol, prev_code > code ? 0x80 : 0, 1);
        var val = diff - uni_adder[i];
        //printf("Val: %d\n", val);
        if (uni_bit_len[i] > 16) {
          val <<= (24 - uni_bit_len[i]);
          ol = append_bits(out, olen, ol, val >> 16, 8);
          ol = append_bits(out, olen, ol, (val >> 8) & 0xFF, 8);
          ol = append_bits(out, olen, ol, val & 0xFF, uni_bit_len[i] - 16);
        } else
        if (uni_bit_len[i] > 8) {
          val <<= (16 - uni_bit_len[i]);
          ol = append_bits(out, olen, ol, val >> 8, 8);
          ol = append_bits(out, olen, ol, val & 0xFF, uni_bit_len[i] - 8);
        } else {
          val <<= (8 - uni_bit_len[i]);
          ol = append_bits(out, olen, ol, val & 0xFF, uni_bit_len[i]);
        }
      //}
      //printf("bits:%d\n", ol-orig_ol);
      return ol;
    }
  }
  return ol;
}

function readUTF8(input, len, l) {
  var ret = 0;
  if (typeof(input) == 'string') {
    ret = input.codePointAt(l);
    return [ret, ret === input.charCodeAt(l) ? 1 : 2];
  }
  var utf8len = 0;
  if (l < (len - 1) && (input[l] & 0xE0) == 0xC0 && (input[l + 1] & 0xC0) == 0x80) {
    utf8len = 2;
    ret = (input[l] & 0x1F);
    ret <<= 6;
    ret += (input[l + 1] & 0x3F);
    if (ret < 0x80)
      ret = 0;
  } else
  if (l < (len - 2) && (input[l] & 0xF0) == 0xE0 && (input[l + 1] & 0xC0) == 0x80
          && (input[l + 2] & 0xC0) == 0x80) {
    utf8len = 3;
    ret = (input[l] & 0x0F);
    ret <<= 6;
    ret += (input[l + 1] & 0x3F);
    ret <<= 6;
    ret += (input[l + 2] & 0x3F);
    if (ret < 0x0800)
      ret = 0;
  } else
  if (l < (len - 3) && (input[l] & 0xF8) == 0xF0 && (input[l + 1] & 0xC0) == 0x80
          && (input[l + 2] & 0xC0) == 0x80 && (input[l + 3] & 0xC0) == 0x80) {
    utf8len = 4;
    ret = (input[l] & 0x07);
    ret <<= 6;
    ret += (input[l + 1] & 0x3F);
    ret <<= 6;
    ret += (input[l + 2] & 0x3F);
    ret <<= 6;
    ret += (input[l + 3] & 0x3F);
    if (ret < 0x10000)
      ret = 0;
  }
  return [ret, utf8len];
}

function matchOccurance(input, len, l, out, olen, ol, state, usx_hcodes, usx_hcode_lens) {
  var j, k;
  var longest_dist = 0;
  var longest_len = 0;
  for (j = l - NICE_LEN; j >= 0; j--) {
    for (k = l; k < len && j + k - l < l; k++) {
      if (input[k] != input[j + k - l])
        break;
    }
    while ((input[k] >> 6) == 2)
      k--; // Skip partial UTF-8 matches
    //if ((in[k - 1] >> 3) == 0x1E || (in[k - 1] >> 4) == 0x0E || (in[k - 1] >> 5) == 0x06)
    //  k--;
    if (k - l > NICE_LEN - 1) {
      var match_len = k - l - NICE_LEN;
      var match_dist = l - j - NICE_LEN + 1;
      if (match_len > longest_len) {
          longest_len = match_len;
          longest_dist = match_dist;
      }
    }
  }
  if (longest_len > 0) {
    ol = append_switch_code(out, olen, ol, state);
    ol = append_bits(out, olen, ol, usx_hcodes[USX_DICT], usx_hcode_lens[USX_DICT]);
    //printf("Len:%d / Dist:%d\n", longest_len, longest_dist);
    ol = encodeCount(out, olen, ol, longest_len);
    ol = encodeCount(out, olen, ol, longest_dist);
    l += (longest_len + NICE_LEN);
    l--;
    return [l, ol];
  }
  return [-l, ol];
}

function matchLine(input, len, l, out, olen, ol, prev_lines, prev_lines_idx, state, usx_hcodes, usx_hcode_lens) {
  var last_ol = ol;
  var last_len = 0;
  var last_dist = 0;
  var last_ctx = 0;
  var line_ctr = 0;
  var j = 0;
  do {
    var i, k;
    var prev_line = prev_lines[prev_lines_idx - line_ctr];
    var line_len = prev_line.length;
    var limit = (line_ctr == 0 ? l : line_len);
    for (; j < limit; j++) {
      for (i = l, k = j; k < line_len && k < limit && i < len; k++, i++) {
        if (prev_line[k] !== input[i])
          break;
      }
      while ((prev_line[k] >> 6) == 2)
        k--; // Skip partial UTF-8 matches
      if ((k - j) >= NICE_LEN) {
        if (last_len > 0) {
          if (j > last_dist)
            continue;
          //int saving = ((k - j) - last_len) + (last_dist - j) + (last_ctx - line_ctr);
          //if (saving < 0) {
          //  //printf("No savng: %d\n", saving);
          //  continue;
          //}
          ol = last_ol;
        }
        last_len = (k - j);
        last_dist = j;
        last_ctx = line_ctr;
        ol = append_switch_code(out, olen, ol, state);
        ol = append_bits(out, olen, ol, usx_hcodes[USX_DICT], usx_hcode_lens[USX_DICT]);
        ol = encodeCount(out, olen, ol, last_len - NICE_LEN);
        ol = encodeCount(out, olen, ol, last_dist);
        ol = encodeCount(out, olen, ol, last_ctx);
        /*
        if ((*ol - last_ol) > (last_len * 4)) {
          last_len = 0;
          *ol = last_ol;
        }*/
        //printf("Len: %d, Dist: %d, Line: %d\n", last_len, last_dist, last_ctx);
        j += last_len;
      }
    }
  } while (line_ctr++ < prev_lines_idx);
  if (last_len > 0) {
    l += last_len;
    l--;
    return [l, ol];
  }
  return [-l, ol];
}

function getBaseCode(ch) {
  if (ch >= 48 && ch <= 57)
    return (ch - 48) << 4;
  else if (ch >= 65 && ch <= 70)
    return (ch - 65 + 10) << 4;
  else if (ch >= 97 && ch <= 102)
    return (ch - 97 + 10) << 4;
  return 0;
}

const USX_NIB_NUM = 0;
const USX_NIB_HEX_LOWER = 1;
const USX_NIB_HEX_UPPER = 2;
const USX_NIB_NOT = 3;
function getNibbleType(ch) {
  if (ch >= 48 && ch <= 57)
    return USX_NIB_NUM;
  else if (ch >= 97 && ch <= 102)
    return USX_NIB_HEX_LOWER;
  else if (ch >= 65 && ch <= 70)
    return USX_NIB_HEX_UPPER;
  return USX_NIB_NOT;
}

function append_nibble_escape(out, olen, ol, state, usx_hcodes, usx_hcode_lens) {
  ol = append_switch_code(out, olen, ol, state);
  ol = append_bits(out, olen, ol, usx_hcodes[USX_NUM], usx_hcode_lens[USX_NUM]);
  ol = append_bits(out, olen, ol, 0, 2);
  return ol;
}

/// Appends the terminator code depending on the state, preset and whether full terminator needs to be encoded to out or not \n
function append_final_bits(out, olen, ol, state, is_all_upper, usx_hcodes, usx_hcode_lens) {
  if (usx_hcode_lens[USX_ALPHA]) {
    if (USX_NUM != state) {
      // for num state, append TERM_CODE directly
      // for other state, switch to Num Set first
      ol = append_switch_code(out, olen, ol, state);
      ol = append_bits(out, olen, ol, usx_hcodes[USX_NUM], usx_hcode_lens[USX_NUM]);
    }
    ol = append_bits(out, olen, ol, usx_vcodes[TERM_CODE & 0x1F], usx_vcode_lens[TERM_CODE & 0x1F]);
  } else {
    // preset 1, terminate at 2 or 3 SW_CODE, i.e., 4 or 6 continuous 0 bits
    // see discussion: https://github.com/siara-cc/Unishox/issues/19#issuecomment-922435580
    ol = append_bits(out, olen, ol, TERM_BYTE_PRESET_1, is_all_upper ? TERM_BYTE_PRESET_1_LEN_UPPER : TERM_BYTE_PRESET_1_LEN_LOWER);
  }

  // fill byte with the last bit
  ol = append_bits(out, olen, ol, (ol == 0 || out[(ol-1)/8] << ((ol-1)&7) >= 0) ? 0 : 0xFF, (8 - ol % 8) & 7);

  return ol;
}

function compare_arr(arr1, arr2, is_str) {
  if (is_str)
    return arr1 === arr2;
  else {
    if (arr1.length !== arr2.length)
      return false;
    for (var i = 0; i < arr2.length; i++) {
      if (arr1.charCodeAt(i) !== arr2[i])
        return false;
    }
  }
  return true;
}

const usx_spl_code = new Uint8Array([0, 0xE0, 0xC0, 0xF0]);
const usx_spl_code_len = new Uint8Array([1, 4, 3, 4]);

function unishox2_compress(input, len, out, usx_hcodes, usx_hcode_lens, usx_freq_seq, usx_templates) {

  var state;

  var l, ll, ol;
  var c_in, c_next;
  var prev_uni;
  var is_upper, is_all_upper;
  var prev_lines_arr = null;
  var prev_lines_idx;

  // if compressing an element in an array, pass the array as input
  // and index of the array to be decompressed in len
  if (input instanceof Array) {
    prev_lines_arr = input;
    prev_lines_idx = len;
    input = prev_lines_arr[prev_lines_idx];
    len = input.length;
  }

  var olen = out.length;

  var is_str = (typeof(input) == "string");

  init_coder();
  ol = 0;
  prev_uni = 0;
  state = USX_ALPHA;
  is_all_upper = false;
  ol = append_bits(out, olen, ol, 0x80, 1); // magic bit
  for (l=0; l<len; l++) {

    if (usx_hcode_lens[USX_DICT] > 0 && l < (len - NICE_LEN + 1)) {
      if (prev_lines_arr !== undefined && prev_lines_arr != null) {
        [l, ol] = matchLine(input, len, l, out, olen, ol, prev_lines_arr, prev_lines_idx, state, usx_hcodes, usx_hcode_lens);
        if (l > 0) {
          continue;
        } else if (l < 0 && ol < 0) {
          return olen + 1;
        }
        l = -l;
      } else {
          [l, ol] = matchOccurance(input, len, l, out, olen, ol, state, usx_hcodes, usx_hcode_lens);
          if (l > 0) {
            continue;
          } else if (l < 0 && ol < 0) {
            return olen + 1;
          }
          l = -l;
      }
    }

    c_in = input[l];
    if (l > 0 && len > 4 && l < len - 4 && usx_hcode_lens[USX_NUM] > 0 && c_in <= (is_str ? '~' : 126)) {
      if (c_in == input[l - 1] && c_in == input[l + 1] && c_in == input[l + 2] &&
          c_in == input[l + 3]) {
        var rpt_count = l + 4;
        while (rpt_count < len && input[rpt_count] == c_in)
          rpt_count++;
        rpt_count -= l;
        [ol, state] = append_code(out, olen, ol, RPT_CODE, state, usx_hcodes, usx_hcode_lens);
        ol = encodeCount(out, olen, ol, rpt_count - 4);
        l += rpt_count;
        l--;
        continue;
      }
    }

    if (l <= (len - 36) && usx_hcode_lens[USX_NUM] > 0) {
      var hyp_code = (is_str ? '-' : 45);
      var hex_type = USX_NIB_NUM;
      if (input[l + 8] === hyp_code && input[l + 13] === hyp_code
          && input[l + 18] === hyp_code && input[l + 23] === hyp_code) {
        var uid_pos = l;
        for (; uid_pos < l + 36; uid_pos++) {
          var c_uid = (is_str ? input.charCodeAt(uid_pos) : input[uid_pos]);
          if (c_uid === 45 && (uid_pos == 8 || uid_pos == 13 || uid_pos == 18 || uid_pos == 23))
            continue;
          var nib_type = getNibbleType(c_uid);
          if (nib_type == USX_NIB_NOT)
            break;
          if (nib_type != USX_NIB_NUM) {
            if (hex_type != USX_NIB_NUM && hex_type != nib_type)
              break;
            hex_type = nib_type;
          }
        }
        if (uid_pos == l + 36) {
          ol = append_nibble_escape(out, olen, ol, state, usx_hcodes, usx_hcode_lens);
          ol = append_bits(out, olen, ol, (hex_type == USX_NIB_HEX_LOWER ? 0xC0 : 0xF0),
                  (hex_type == USX_NIB_HEX_LOWER ? 3 : 5));
          for (uid_pos = l; uid_pos < l + 36; uid_pos++) {
            var c_uid = (is_str ? input.charCodeAt(uid_pos) : input[uid_pos]);
            if (c_uid !== 45) // '-'
              ol = append_bits(out, olen, ol, getBaseCode(c_uid), 4);
          }
          //printf("GUID:\n");
          l += 35;
          continue;
        }
      }
    }

    if (l < (len - 5) && usx_hcode_lens[USX_NUM] > 0) {
      var hex_type = USX_NIB_NUM;
      var hex_len = 0;
      do {
        var c_uid = (is_str ? input.charCodeAt(l + hex_len) : input[l + hex_len]);
        var nib_type = getNibbleType(c_uid);
        if (nib_type == USX_NIB_NOT)
          break;
        if (nib_type != USX_NIB_NUM) {
          if (hex_type != USX_NIB_NUM && hex_type != nib_type)
            break;
          hex_type = nib_type;
        }
        hex_len++;
      } while (l + hex_len < len);
      if (hex_len > 10 && hex_type == USX_NIB_NUM)
        hex_type = USX_NIB_HEX_LOWER;
      if ((hex_type == USX_NIB_HEX_LOWER || hex_type == USX_NIB_HEX_UPPER) && hex_len > 3) {
        ol = append_nibble_escape(out, olen, ol, state, usx_hcodes, usx_hcode_lens);
        ol = append_bits(out, olen, ol, (hex_type == USX_NIB_HEX_LOWER ? 0x80 : 0xE0), (hex_type == USX_NIB_HEX_LOWER ? 2 : 4));
        ol = encodeCount(out, olen, ol, hex_len);
        do {
          var c_uid = (is_str ? input.charCodeAt(l) : input[l]);
          ol = append_bits(out, olen, ol, getBaseCode(c_uid), 4);
          l++;
        } while (--hex_len > 0);
        l--;
        continue;
      }
    }

    if (usx_templates != null && usx_templates != undefined) {
      var i;
      for (i = 0; i < 5; i++) {
        if (typeof(usx_templates[i]) == 'string') {
          var rem = usx_templates[i].length;
          var j = 0;
          for (; j < rem && l + j < len; j++) {
            var c_t = usx_templates[i][j];
            c_in = (is_str ? input.charCodeAt(l + j) : input[l + j]);
            if (c_t === 'f' || c_t === 'F') {
              if (getNibbleType(c_in) != (c_t === 'f' ? USX_NIB_HEX_LOWER : USX_NIB_HEX_UPPER)
                       && getNibbleType(c_in) != USX_NIB_NUM) {
                break;
              }
            } else
            if (c_t === 'r' || c_t === 't' || c_t === 'o') {
              // if c_in does not fall into the number range
              if (c_in < 48 || c_in > (c_t === 'r' ? 55 : (c_t === 't' ? 51 : 49)))
                break;
            } else
            if (c_t.charCodeAt(0) !== c_in)
              break;
          }
          if ((j / rem) > 0.66) {
            //printf("%s\n", usx_templates[i]);
            rem = rem - j;
            ol = append_nibble_escape(out, olen, ol, state, usx_hcodes, usx_hcode_lens);
            ol = append_bits(out, olen, ol, 0, 1);
            ol = append_bits(out, olen, ol, (count_codes[i] & 0xF8), count_codes[i] & 0x07);
            ol = encodeCount(out, olen, ol, rem);
            for (var k = 0; k < j; k++) {
              var c_t = usx_templates[i][k];
              c_in = (is_str ? input.charCodeAt(l + k) : input[l + k]);
              if (c_t === 'f' || c_t === 'F') {
                ol = append_bits(out, olen, ol, getBaseCode(c_in), 4);
              } else if (c_t === 'r' || c_t === 't' || c_t === 'o') {
                c_t = (c_t === 'r' ? 3 : (c_t === 't' ? 2 : 1));
                ol = append_bits(out, olen, ol, (c_in - 48) << (8 - c_t), c_t);
              }
            }
            l += j;
            l--;
            break;
          }
        }
      }
      if (i < 5)
        continue;
    }

    if (usx_freq_seq != null) {
      var i;
      for (i = 0; i < 6; i++) {
        var seq_len = usx_freq_seq[i].length;
        if (len - seq_len >= 0 && l <= len - seq_len) {
          if (usx_hcode_lens[usx_freq_codes[i] >> 5] &&
              compare_arr(usx_freq_seq[i].slice(0, seq_len), input.slice(l, l + seq_len), is_str)) {
            [ol, state] = append_code(out, olen, ol, usx_freq_codes[i], state, usx_hcodes, usx_hcode_lens);
            l += seq_len;
            l--;
            break;
          }
        }
      }
      if (i < 6)
        continue;
    }
    c_in = (is_str ? input.charCodeAt(l) : input[l]);

    is_upper = false;
    if (c_in >= 65 && c_in <= 90) // A-Z
      is_upper = true;
    else {
      if (is_all_upper) {
        is_all_upper = false;
        ol = append_switch_code(out, olen, ol, state);
        ol = append_bits(out, olen, ol, usx_hcodes[USX_ALPHA], usx_hcode_lens[USX_ALPHA]);
        state = USX_ALPHA;
      }
    }
    if (is_upper && !is_all_upper) {
      if (state == USX_NUM) {
        ol = append_switch_code(out, olen, ol, state);
        ol = append_bits(out, olen, ol, usx_hcodes[USX_ALPHA], usx_hcode_lens[USX_ALPHA]);
        state = USX_ALPHA;
      }
      ol = append_switch_code(out, olen, ol, state);
      ol = append_bits(out, olen, ol, usx_hcodes[USX_ALPHA], usx_hcode_lens[USX_ALPHA]);
      if (state == USX_DELTA) {
        state = USX_ALPHA;
        ol = append_switch_code(out, olen, ol, state);
        ol = append_bits(out, olen, ol, usx_hcodes[USX_ALPHA], usx_hcode_lens[USX_ALPHA]);
      }
    }
    c_next = 0;
    if (l+1 < len)
      c_next = (is_str ? input.charCodeAt(l + 1) : input[l + 1]);

    if (c_in >= 32 && c_in <= 126) { // ' ' to '~'
      if (is_upper && !is_all_upper) {
        for (ll=l+4; ll>=l && ll<len; ll--) {
          var c_u = (is_str ? input.charCodeAt(ll) : input[ll]);
          if (c_u < 65 || c_u > 90) // ~ A-Z
            break;
        }
        if (ll == l-1) {
          ol = append_switch_code(out, olen, ol, state);
          ol = append_bits(out, olen, ol, usx_hcodes[USX_ALPHA], usx_hcode_lens[USX_ALPHA]);
          state = USX_ALPHA;
          is_all_upper = true;
        }
      }
      if (state == USX_DELTA) {
        var ch_idx = " .,".indexOf(String.fromCharCode(c_in));
        if (ch_idx != -1) {
          ol = append_bits(out, olen, ol, UNI_STATE_SPL_CODE, UNI_STATE_SPL_CODE_LEN);
          ol = append_bits(out, olen, ol, usx_spl_code[ch_idx], usx_spl_code_len[ch_idx]);
          continue;
        }
      }
      c_in -= 32;
      if (is_all_upper && is_upper)
        c_in += 32;
      if (c_in === 0) {
        if (state == USX_NUM)
          ol = append_bits(out, olen, ol, usx_vcodes[NUM_SPC_CODE & 0x1F], usx_vcode_lens[NUM_SPC_CODE & 0x1F]);
        else
          ol = append_bits(out, olen, ol, usx_vcodes[1], usx_vcode_lens[1]);
      } else {
        c_in = c_in - 1;
        [ol, state] = append_code(out, olen, ol, usx_code_94[c_in], state, usx_hcodes, usx_hcode_lens);
      }
    } else
    if (c_in === 13 && c_next === 10) {
      [ol, state] = append_code(out, olen, ol, CRLF_CODE, state, usx_hcodes, usx_hcode_lens);
      l++;
    } else
    if (c_in === 10) {
      if (state == USX_DELTA) {
        ol = append_bits(out, olen, ol, UNI_STATE_SPL_CODE, UNI_STATE_SPL_CODE_LEN);
        ol = append_bits(out, olen, ol, 0xF0, 4);
      } else
        [ol, state] = append_code(out, olen, ol, LF_CODE, state, usx_hcodes, usx_hcode_lens);
    } else
    if (c_in === 13) {
      [ol, state] = append_code(out, olen, ol, CR_CODE, state, usx_hcodes, usx_hcode_lens);
    } else
    if (c_in === 9) {
      [ol, state] = append_code(out, olen, ol, TAB_CODE, state, usx_hcodes, usx_hcode_lens);
    } else {
      var uni, utf8len;
      [uni, utf8len] = readUTF8(input, len, l);
      if (uni > 0) {
        l += utf8len;
        if (state != USX_DELTA) {
          [uni2, utf8len] = readUTF8(input, len, l);
          if (uni2 > 0) {
            if (state != USX_ALPHA) {
              ol = append_switch_code(out, olen, ol, state);
              ol = append_bits(out, olen, ol, usx_hcodes[USX_ALPHA], usx_hcode_lens[USX_ALPHA]);
            }
            ol = append_switch_code(out, olen, ol, state);
            ol = append_bits(out, olen, ol, usx_hcodes[USX_ALPHA], usx_hcode_lens[USX_ALPHA]);
            ol = append_bits(out, olen, ol, usx_vcodes[1], usx_vcode_lens[1]); // code for space (' ')
            state = USX_DELTA;
          } else {
            ol = append_switch_code(out, olen, ol, state);
            ol = append_bits(out, olen, ol, usx_hcodes[USX_DELTA], usx_hcode_lens[USX_DELTA]);
          }
        }
        ol = encodeUnicode(out, olen, ol, uni, prev_uni);
        //console.log("%d:%d:%d,", l, utf8len, uni);
        prev_uni = uni;
        l--;
      } else {
        var bin_count = 1;
        for (var bi = l + 1; bi < len; bi++) {
          var c_bi = input[bi];
          //if (c_bi > 0x1F && c_bi != 0x7F)
          //  break;
          if (readUTF8(input, len, bi) > 0)
            break;
          if (bi < (len - 4) && c_bi === input[bi - 1] && c_bi === input[bi + 1] 
                && c_bi === input[bi + 2] && c_bi === input[bi + 3])
            break;
          bin_count++;
        }
        //printf("Bin:%d:%d:%x:%d\n", l, (unsigned char) c_in, (unsigned char) c_in, bin_count);
        ol = append_nibble_escape(out, olen, ol, state, usx_hcodes, usx_hcode_lens);
        ol = append_bits(out, olen, ol, 0xF8, 5);
        ol = encodeCount(out, olen, ol, bin_count);
        do {
          ol = append_bits(out, olen, ol, input[l++], 8);
        } while (--bin_count > 0);
        l--;
      }
    }
  }

  if (need_full_term_codes) {
    var orig_ol = ol;
    ol = append_final_bits(out, olen, ol, state, is_all_upper, usx_hcodes, usx_hcode_lens);
    return (ol / 8) * 4 + (((ol-orig_ol)/8) & 3);
  } else {
    var rst = (ol + 7) / 8;
    ol = append_final_bits(out, rst, ol, state, is_all_upper, usx_hcodes, usx_hcode_lens);
    return rst;
  }

}

function unishox2_compress_simple(input, len, out) {
  return unishox2_compress(input, len, out, USX_HCODES_DFLT, USX_HCODE_LENS_DFLT, USX_FREQ_SEQ_DFLT, USX_TEMPLATES);
}

function readBit(input, bit_no) {
   return input[bit_no >> 3] & (0x80 >> (bit_no % 8));
}

function read8bitCode(input, len, bit_no) {
  var bit_pos = bit_no & 0x07;
  var char_pos = bit_no >> 3;
  len >>= 3;
  var code = (input[char_pos] << bit_pos) & 0xFF;
  char_pos++;
  if (char_pos < len) {
    code |= input[char_pos] >> (8 - bit_pos);
  } else
    code |= (0xFF >> (8 - bit_pos));
  return [code, bit_no];
}

// Decoder is designed for using less memory, not speed
const SECTION_COUNT = 5;
const usx_vsections = new Uint8Array([0x7F, 0xBF, 0xDF, 0xEF, 0xFF]);
const usx_vsection_pos = new Uint8Array([0, 4, 8, 12, 20]);
const usx_vsection_mask = new Uint8Array([0x7F, 0x3F, 0x1F, 0x0F, 0x0F]);
const usx_vsection_shift = new Uint8Array([5, 4, 3, 1, 0]);

// Vertical decoder lookup table - 3 bits code len, 5 bytes vertical pos
// code len is one less as 8 cannot be accommodated in 3 bits
const usx_vcode_lookup = new Uint8Array([
  (1 << 5) + 0,  (1 << 5) + 0,  (2 << 5) + 1,  (2 << 5) + 2,  // Section 1
  (3 << 5) + 3,  (3 << 5) + 4,  (3 << 5) + 5,  (3 << 5) + 6,  // Section 2
  (3 << 5) + 7,  (3 << 5) + 7,  (4 << 5) + 8,  (4 << 5) + 9,  // Section 3
  (5 << 5) + 10, (5 << 5) + 10, (5 << 5) + 11, (5 << 5) + 11, // Section 4
  (5 << 5) + 12, (5 << 5) + 12, (6 << 5) + 13, (6 << 5) + 14,
  (6 << 5) + 15, (6 << 5) + 15, (6 << 5) + 16, (6 << 5) + 16, // Section 5
  (6 << 5) + 17, (6 << 5) + 17, (7 << 5) + 18, (7 << 5) + 19,
  (7 << 5) + 20, (7 << 5) + 21, (7 << 5) + 22, (7 << 5) + 23,
  (7 << 5) + 24, (7 << 5) + 25, (7 << 5) + 26, (7 << 5) + 27
]);

function readVCodeIdx(input, len, bit_no) {
  if (bit_no < len) {
    var code;
    [code, bit_no] = read8bitCode(input, len, bit_no);
    var i = 0;
    do {
      if (code <= usx_vsections[i]) {
        var vcode = usx_vcode_lookup[usx_vsection_pos[i] + ((code & usx_vsection_mask[i]) >> usx_vsection_shift[i])];
        bit_no += ((vcode >> 5) + 1);
        if (bit_no > len)
          return [99, bit_no];
        return [vcode & 0x1F, bit_no];
      }
    } while (++i < SECTION_COUNT);
  }
  return [99, bit_no];
}

const len_masks = new Uint8Array([0x80, 0xC0, 0xE0, 0xF0, 0xF8, 0xFC, 0xFE, 0xFF]);
function readHCodeIdx(input, len, bit_no, usx_hcodes, usx_hcode_lens) {
  if (!usx_hcode_lens[USX_ALPHA])
    return [USX_ALPHA, bit_no];
  if (bit_no < len) {
    var code;
    [code, bit_no] = read8bitCode(input, len, bit_no);
    for (var code_pos = 0; code_pos < 5; code_pos++) {
      if (usx_hcode_lens[code_pos] > 0 && (code & len_masks[usx_hcode_lens[code_pos] - 1]) == usx_hcodes[code_pos]) {
        bit_no += usx_hcode_lens[code_pos];
        return [code_pos, bit_no];
      }
    }
  }
  return [99, bit_no];
}

// TODO: Last value check.. Also len check in readBit
function getStepCodeIdx(input, len, bit_no, limit) {
  var idx = 0;
  while (bit_no < len && readBit(input, bit_no) > 0) {
    idx++;
    bit_no++;
    if (idx == limit)
      return [idx, bit_no];
  }
  if (bit_no >= len)
    return [99, bit_no];
  bit_no++;
  return [idx, bit_no];
}

function getNumFromBits(input, len, bit_no, count) {
   var ret = 0;
   while (count-- > 0 && bit_no < len) {
     ret += (readBit(input, bit_no) > 0 ? 1 << count : 0);
     bit_no++;
   }
   return count < 0 ? ret : -1;
}

function readCount(input, bit_no, len) {
  var idx = 0;
  [idx, bit_no] = getStepCodeIdx(input, len, bit_no, 4);
  if (idx == 99)
    return [-1, bit_no];
  if (bit_no + count_bit_lens[idx] - 1 >= len)
    return [-1, bit_no];
  var count = getNumFromBits(input, len, bit_no, count_bit_lens[idx]) + (idx > 0 ? count_adder[idx - 1] : 0);
  bit_no += count_bit_lens[idx];
  return [count, bit_no];
}

function readUnicode(input, bit_no, len) {
  var idx = 0;
  [idx, bit_no] = getStepCodeIdx(input, len, bit_no, 5);
  if (idx == 99)
    return [0x7FFFFF00 + 99, bit_no];
  if (idx == 5) {
    [idx, bit_no] = getStepCodeIdx(input, len, bit_no, 4);
    return [0x7FFFFF00 + idx, bit_no];
  }
  if (idx >= 0) {
    var sign = (bit_no < len ? readBit(input, bit_no) : 0);
    bit_no++;
    if (bit_no + uni_bit_len[idx] - 1 >= len)
      return [0x7FFFFF00 + 99, bit_no];
    var count = getNumFromBits(input, len, bit_no, uni_bit_len[idx]);
    count += uni_adder[idx];
    bit_no += uni_bit_len[idx];
    //printf("Sign: %d, Val:%d", sign, count);
    return [sign > 0 ? -count : count, bit_no];
  }
  return [0, bit_no];
}

function decodeRepeatArray(input, len, out_arr, out, bit_no, prev_lines_arr, prev_lines_idx,
                            usx_hcodes, usx_hcode_lens, usx_freq_seq, usx_templates) {
  var dict_len = 0;
  [dict_len, bit_no] = readCount(input, bit_no, len);
  dict_len += NICE_LEN;
  if (dict_len < NICE_LEN)
    return [-1, out];
  var dist = 0;
  [dist, bit_no] = readCount(input, bit_no, len);
  if (dist < 0)
    return [-1, out];
  var ctx = 0;
  [ctx, bit_no] = readCount(input, bit_no, len);
  if (ctx < 0)
    return [-1, out];
  var line;
  if (ctx == 0)
    line = (out_arr == null ? out : out_arr);
  else {
    if (prev_lines_idx < ctx)
      return [-1, out];
    if (out_arr == null) {
      line = unishox2_decompress(prev_lines_arr, prev_lines_idx - ctx, null,
              usx_hcodes, usx_hcode_lens, usx_freq_seq, usx_templates);
    } else {
      line = new Uint8Array((dist + dict_len) * 2);
      unishox2_decompress(prev_lines_arr, prev_lines_idx - ctx, line,
        usx_hcodes, usx_hcode_lens, usx_freq_seq, usx_templates);
    }
  }
  if (out_arr == null) {
    out += (typeof(line) == "string" ? line.substr(dist, dict_len) : line.slice(dist, dict_len));
  } else {
    for (var i = 0; i < dict_len; i++) {
      if (out >= out_arr.length)
        break;
      out_arr[out] = line[dist + i];
      out++;
    }
  }
  return [bit_no, out];
}

function decodeRepeat(input, len, out_arr, out, bit_no) {
  var dict_len = 0;
  [dict_len, bit_no] = readCount(input, bit_no, len);
  dict_len += NICE_LEN;
  if (dict_len < NICE_LEN)
    return [-1, out];
  var dist = 0;
  [dist, bit_no] = readCount(input, bit_no, len);
  dist += (NICE_LEN - 1);
  if (dist < NICE_LEN - 1)
    return [-1, out];
  //console.log("Decode len: %d, dist: %d\n", dict_len - NICE_LEN, dist - NICE_LEN + 1);
  if (out_arr == null) {
    if (out.length < dist)
      return [-1, out];
    out += out.substr(out.length - dist, dict_len);
  } else {
    for (var i = 0; i < dict_len; i++) {
      if (out >= out_arr.length)
        break;
      out_arr[out] = out_arr[out - dist];
      out++;
    }
  }
  return [bit_no, out];
}

function getHexChar(nibble, hex_type) {
  if (nibble >= 0 && nibble <= 9)
    return String.fromCharCode(48 + nibble);
  else if (hex_type < USX_NIB_HEX_UPPER)
    return String.fromCharCode(97 + nibble - 10);
  return String.fromCharCode(65 + nibble - 10);
}

function writeUTF8(out_arr, out, uni) {
  if (uni < (1 << 11)) {
    out_arr[out++] = (0xC0 + (uni >> 6));
    out_arr[out++] = (0x80 + (uni & 0x3F));
  } else
  if (uni < (1 << 16)) {
    out_arr[out++] = (0xE0 + (uni >> 12));
    out_arr[out++] = (0x80 + ((uni >> 6) & 0x3F));
    out_arr[out++] = (0x80 + (uni & 0x3F));
  } else {
    out_arr[out++] = (0xF0 + (uni >> 18));
    out_arr[out++] = (0x80 + ((uni >> 12) & 0x3F));
    out_arr[out++] = (0x80 + ((uni >> 6) & 0x3F));
    out_arr[out++] = (0x80 + (uni & 0x3F));
  }
  return out;
}

function appendChar(out_arr, out, ch) {
  if (out_arr == null)
    out += ch;
  else {
    if (out < out_arr.length)
      out_arr[out++] = ch.charCodeAt(0);
  }
  return out;
}

function appendString(out_arr, out, str) {
  if (out_arr == null)
    out += str;
  else {
    for (var i = 0; i < str.length; i++) {
      if (out >= out_arr.length)
        break;
      out_arr[out++] = str.charCodeAt(i);
    }
  }
  return out;
}

function unishox2_decompress(input, len, out_arr, usx_hcodes, usx_hcode_lens, usx_freq_seq, usx_templates) {

  var dstate;
  var bit_no;
  var h, v;
  var is_all_upper;
  var prev_lines_arr = null;
  var prev_lines_idx;

  init_coder();
  bit_no = 1; // ignore the magic bit
  dstate = h = USX_ALPHA;
  is_all_upper = 0;
  var prev_uni = 0;

  // if decompressing an element in an array, pass the array as input
  // and index of the array to be decompressed in len
  if (input instanceof Array) {
    prev_lines_arr = input;
    prev_lines_idx = len;
    input = prev_lines_arr[prev_lines_idx];
    len = input.length;
  }

  len <<= 3;
  var out = (out_arr == null ? "" : 0); // if out_arr is present, out holds current position of out_arr
  while (bit_no < len) {
    var orig_bit_no = bit_no;
    if (dstate == USX_DELTA || h == USX_DELTA) {
      if (dstate != USX_DELTA)
        h = dstate;
      var delta;
      [delta, bit_no] = readUnicode(input, bit_no, len);
      if ((delta >> 8) == 0x7FFFFF) {
        var spl_code_idx = delta & 0x000000FF;
        if (spl_code_idx == 99)
          break;
        switch (spl_code_idx) {
          case 0:
            out = appendChar(out_arr, out, ' ');
            continue;
          case 1:
            [h, bit_no] = readHCodeIdx(input, len, bit_no, usx_hcodes, usx_hcode_lens);
            if (h == 99) {
              bit_no = len;
              continue;
            }
            if (h == USX_DELTA || h == USX_ALPHA) {
              dstate = h;
              continue;
            }
            if (h == USX_DICT) {
              if (prev_lines_arr == null)
                [bit_no, out] = decodeRepeat(input, len, out_arr, out, bit_no);
              else {
                [bit_no, out] = decodeRepeatArray(input, len, out_arr, out, bit_no, 
                  prev_lines_arr, prev_lines_idx, usx_hcodes, usx_hcode_lens, usx_freq_seq, usx_templates);
              }
              if (bit_no < 0)
                return out;
              h = dstate;
              continue;
            }
            break;
          case 2:
            out = appendChar(out_arr, out, ',');
            continue;
          case 3:
            out = appendChar(out_arr, out, '.');
            continue;
          case 4:
            out = appendChar(out_arr, out, String.fromCharCode(10));
            continue;
        }
      } else {
        prev_uni += delta;
        if (prev_uni > 0) {
          if (out_arr == null)
            out += String.fromCodePoint(prev_uni);
          else
            out = writeUTF8(out_arr, out, prev_uni);
        }
        //printf("%ld, ", prev_uni);
      }
      if (dstate == USX_DELTA && h == USX_DELTA)
        continue;
    } else
      h = dstate;
    var c = "";
    var is_upper = is_all_upper;
    [v, bit_no] = readVCodeIdx(input, len, bit_no);
    if (v == 99 || h == 99) {
      bit_no = orig_bit_no;
      break;
    }
    if (v == 0 && h != USX_SYM) {
      if (bit_no >= len)
        break;
      if (h != USX_NUM || dstate != USX_DELTA) {
        [h, bit_no] = readHCodeIdx(input, len, bit_no, usx_hcodes, usx_hcode_lens);
        if (h == 99 || bit_no >= len) {
          bit_no = orig_bit_no;
          break;
        }
      }
      if (h == USX_ALPHA) {
         if (dstate == USX_ALPHA) {
           if (usx_hcode_lens[USX_ALPHA] == 0 && TERM_BYTE_PRESET_1 == (read8bitCode(input, len, bit_no - SW_CODE_LEN) & (0xFF << (8 - (is_all_upper ? TERM_BYTE_PRESET_1_LEN_UPPER : TERM_BYTE_PRESET_1_LEN_LOWER)))))
             break; // Terminator for preset 1
           if (is_all_upper) {
             is_upper = is_all_upper = 0;
             continue;
           }
           [v, bit_no] = readVCodeIdx(input, len, bit_no);
           if (v == 99) {
             bit_no = orig_bit_no;
             break;
           }
           if (v == 0) {
              [h, bit_no] = readHCodeIdx(input, len, bit_no, usx_hcodes, usx_hcode_lens);
              if (h == 99) {
                bit_no = orig_bit_no;
                break;
              }
              if (h == USX_ALPHA) {
                 is_all_upper = 1;
                 continue;
              }
           }
           is_upper = 1;
         } else {
            dstate = USX_ALPHA;
            continue;
         }
      } else
      if (h == USX_DICT) {
        if (prev_lines_arr == null)
          [bit_no, out] = decodeRepeat(input, len, out_arr, out, bit_no);
        else {
          [bit_no, out] = decodeRepeatArray(input, len, out_arr, out, bit_no, 
            prev_lines_arr, prev_lines_idx, usx_hcodes, usx_hcode_lens, usx_freq_seq, usx_templates);
        }
        if (bit_no < 0)
          break;
        continue;
      } else
      if (h == USX_DELTA) {
        //printf("Sign: %d, bitno: %d\n", sign, bit_no);
        //printf("Code: %d\n", prev_uni);
        //printf("BitNo: %d\n", bit_no);
        continue;
      } else {
        if (h != USX_NUM || dstate != USX_DELTA)
          [v, bit_no] = readVCodeIdx(input, len, bit_no);
        if (v == 99) {
          bit_no = orig_bit_no;
          break;
        }
        if (h == USX_NUM && v == 0) {
          var idx;
          [idx, bit_no] = getStepCodeIdx(input, len, bit_no, 5);
          if (idx == 99)
            break;
          if (idx == 0) {
            [idx, bit_no] = getStepCodeIdx(input, len, bit_no, 4);
            if (idx >= 5)
              break;
            var rem;
            [rem, bit_no] = readCount(input, bit_no, len);
            if (rem < 0)
              break;
            if (usx_templates == null || usx_templates[idx] == null)
              break;
            var tlen = usx_templates[idx].length;
            if (rem > tlen)
              break;
            rem = tlen - rem;
            var eof = false;
            for (var j = 0; j < rem; j++) {
              var c_t = usx_templates[idx][j];
              if (c_t === 'f' || c_t === 'r' || c_t === 't' || c_t === 'o' || c_t === 'F') {
                  var nibble_len = (c_t === 'f' || c_t === 'F' ? 4 : (c_t === 'r' ? 3 : (c_t === 't' ? 2 : 1)));
                  var raw_char = getNumFromBits(input, len, bit_no, nibble_len);
                  if (raw_char < 0) {
                      eof = true;
                      break;
                  }
                  var nibble_char = getHexChar(raw_char,
                        c_t === 'f' ? USX_NIB_HEX_LOWER : USX_NIB_HEX_UPPER);
                  out = appendChar(out_arr, out, nibble_char);
                  bit_no += nibble_len;
              } else
                out = appendChar(out_arr, out, c_t);
            }
            if (eof) break;
          } else
          if (idx == 5) {
            var bin_count;
            [bin_count, bit_no] = readCount(input, bit_no, len);
            if (bin_count < 0)
              break;
            if (bin_count == 0) // invalid encoding
              break;
            do {
              var raw_char = getNumFromBits(input, len, bit_no, 8);
              if (raw_char < 0)
                  break;
              var bin_byte = String.fromCharCode(raw_char);
              out = appendChar(out_arr, out, bin_byte);
              bit_no += 8;
            } while (--bin_count > 0);
          } else {
            var nibble_count = 0;
            if (idx == 2 || idx == 4)
              nibble_count = 32;
            else {
              [nibble_count, bit_no] = readCount(input, bit_no, len);
              if (nibble_count < 0)
                break;
              if (nibble_count == 0) // invalid encoding
                break;
            }
            do {
              var nibble = getNumFromBits(input, len, bit_no, 4);
              if (nibble < 0)
                  break;
              var nibble_char = getHexChar(nibble, idx < 3 ? USX_NIB_HEX_LOWER : USX_NIB_HEX_UPPER);
              out = appendChar(out_arr, out, nibble_char);
              if ((idx == 2 || idx == 4) && (nibble_count == 25 || nibble_count == 21 || nibble_count == 17 || nibble_count == 13))
                out = appendChar(out_arr, out, '-');
              bit_no += 4;
            } while (--nibble_count > 0);
            if (nibble_count > 0) break; // reach input eof
          }
          if (dstate == USX_DELTA)
            h = USX_DELTA;
          continue;
        }
      }
    }
    if (is_upper && v == 1) {
      h = dstate = USX_DELTA; // continuous delta coding
      continue;
    }
    // TODO: Binary    out[ol++] = readCount(in, &bit_no, len);
    if (h < 3 && v < 28)
      c = usx_sets[h].charAt(v);
    if (c >= 'a' && c <= 'z') {
      dstate = USX_ALPHA;
      if (is_upper)
        c = String.fromCharCode(c.charCodeAt(0)-32);
    } else {
      if (c !== 0 && c.charCodeAt(0) >= 48 && c.charCodeAt(0) <= 57)
        dstate = USX_NUM;
      else if (c.charCodeAt(0) === 0 && c !== '0') {
        if (v == 8) {
          out = appendString(out_arr, out, "\r\n");
        } else if (h == USX_NUM && v == 26) {
          var count;
          [count, bit_no] = readCount(input, bit_no, len);
          if (count < 0)
            break;
          count += 4;
          var rpt_c = (out_arr == null ? out.charAt(out.length - 1) : String.fromCharCode(out_arr[out - 1]));
          while (count--)
            out = appendChar(out_arr, out, rpt_c);
        } else if (h == USX_SYM && v > 24) {
          v -= 25;
          out = appendString(out_arr, out, usx_freq_seq[v]);
        } else if (h == USX_NUM && v > 22 && v < 26) {
          v -= (23 - 3);
          out = appendString(out_arr, out, usx_freq_seq[v]);
        } else
          break; // Terminator
        if (dstate == USX_DELTA)
          h = USX_DELTA;
        continue;
      }
    }
    if (dstate == USX_DELTA)
      h = USX_DELTA;
    out = appendChar(out_arr, out, c);
  }

  return out;

}

function unishox2_decompress_simple(input, len) {
  return unishox2_decompress(input, len, null, USX_HCODES_DFLT, USX_HCODE_LENS_DFLT, USX_FREQ_SEQ_DFLT, USX_TEMPLATES);
}


// Source: https://gist.github.com/romeoh/3302256

/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */
/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */
var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */
/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_sha1(s){return binb2hex(core_sha1(str2binb(s),s.length * chrsz));}
function b64_sha1(s){return binb2b64(core_sha1(str2binb(s),s.length * chrsz));}
function str_sha1(s){return binb2str(core_sha1(str2binb(s),s.length * chrsz));}
function hex_hmac_sha1(key, data){ return binb2hex(core_hmac_sha1(key, data));}
function b64_hmac_sha1(key, data){ return binb2b64(core_hmac_sha1(key, data));}
function str_hmac_sha1(key, data){ return binb2str(core_hmac_sha1(key, data));}
/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test()
{
return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
}
/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1(x, len)
{
/* append padding */
x[len >> 5] |= 0x80 << (24 - len % 32);
x[((len + 64 >> 9) << 4) + 15] = len;
var w = Array(80);
var a =  1732584193;
var b = -271733879;
var c = -1732584194;
var d =  271733878;
var e = -1009589776;
for(var i = 0; i < x.length; i += 16)
{
var olda = a;
var oldb = b;
var oldc = c;
var oldd = d;
var olde = e;
for(var j = 0; j < 80; j++)
{
if(j < 16) w[j] = x[i + j];
else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
safe_add(safe_add(e, w[j]), sha1_kt(j)));
e = d;
d = c;
c = rol(b, 30);
b = a;
a = t;
}
a = safe_add(a, olda);
b = safe_add(b, oldb);
c = safe_add(c, oldc);
d = safe_add(d, oldd);
e = safe_add(e, olde);
}
return Array(a, b, c, d, e);
}
/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
if(t < 20) return (b & c) | ((~b) & d);
if(t < 40) return b ^ c ^ d;
if(t < 60) return (b & c) | (b & d) | (c & d);
return b ^ c ^ d;
}
/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
(t < 60) ? -1894007588 : -899497514;
}
/*
 * Calculate the HMAC-SHA1 of a key and some data
 */
function core_hmac_sha1(key, data)
{
var bkey = str2binb(key);
if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);
var ipad = Array(16), opad = Array(16);
for(var i = 0; i < 16; i++)
{
ipad[i] = bkey[i] ^ 0x36363636;
opad[i] = bkey[i] ^ 0x5C5C5C5C;
}
var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
return core_sha1(opad.concat(hash), 512 + 160);
}
/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
var lsw = (x & 0xFFFF) + (y & 0xFFFF);
var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
return (msw << 16) | (lsw & 0xFFFF);
}
/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt)
{
return (num << cnt) | (num >>> (32 - cnt));
}
/*
 * Convert an 8-bit or 16-bit string to an array of big-endian words
 * In 8-bit function, characters >255 have their hi-byte silently ignored.
 */
function str2binb(str)
{
var bin = Array();
var mask = (1 << chrsz) - 1;
for(var i = 0; i < str.length * chrsz; i += chrsz)
bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
return bin;
}
/*
 * Convert an array of big-endian words to a string
 */
function binb2str(bin)
{
var str = "";
var mask = (1 << chrsz) - 1;
for(var i = 0; i < bin.length * 32; i += chrsz)
str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
return str;
}
/*
 * Convert an array of big-endian words to a hex string.
 */
function binb2hex(binarray)
{
var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
var str = "";
for(var i = 0; i < binarray.length * 4; i++)
{
str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
}
return str;
}
/*
 * Convert an array of big-endian words to a base-64 string
 */
function binb2b64(binarray)
{
var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var str = "";
for(var i = 0; i < binarray.length * 4; i += 3)
{
var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
| (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
|  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
for(var j = 0; j < 4; j++)
{
if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
}
}
return str;
}

// Source: https://gist.github.com/kiasaki/9e69449640fc1ec29e0def97e1ddd6bf. Modified to use Uint8Array instead of string

var base32 = {
    a: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    pad: "=",
    encode: function (uint8array) {
        var a = this.a;
        var pad = this.pad;
        var len = uint8array.length;
        var o = "";
        var w, c, r=0, sh=0;
        for(i=0; i<len; i+=5) {
            // mask top 5 bits
            c = uint8array[i];
            w = 0xf8 & c;
            o += a.charAt(w>>3);
            r = 0x07 & c;
            sh = 2;

            if ((i+1)<len) {
                c = uint8array[i+1];
                // mask top 2 bits
                w = 0xc0 & c;
                o += a.charAt((r<<2) + (w>>6));
                o += a.charAt( (0x3e & c) >> 1 );
                r = c & 0x01;
                sh = 4;
            }

            if ((i+2)<len) {
                c = uint8array[i+2];
                // mask top 4 bits
                w = 0xf0 & c;
                o += a.charAt((r<<4) + (w>>4));
                r = 0x0f & c;
                sh = 1;
            }

            if ((i+3)<len) {
                c = uint8array[i+3];
                // mask top 1 bit
                w = 0x80 & c;
                o += a.charAt((r<<1) + (w>>7));
                o += a.charAt((0x7c & c) >> 2);
                r = 0x03 & c;
                sh = 3;
            }

            if ((i+4)<len) {
                c = uint8array[i+4];
                // mask top 3 bits
                w = 0xe0 & c;
                o += a.charAt((r<<3) + (w>>5));
                o += a.charAt(0x1f & c);
                r = 0;
                sh = 0;
            } 
        }
        // Calculate length of pad by getting the 
        // number of words to reach an 8th octet.
        if (r!=0) { o += a.charAt(r<<sh); }
       
        let padLength = Math.ceil(o.length / 8) * 8 - o.length; 
        return o + pad.repeat(padLength);
    },
    decode: function(s) {
        var len = s.length;
        var apad = this.a + this.pad;
        var v,x,r=0,bits=0,c;
        var out_buf = [];


        s = s.toUpperCase();

        for(i=0;i<len;i+=1) {
            v = apad.indexOf(s.charAt(i));
            if (v>=0 && v<32) {
                x = (x << 5) | v;
                bits += 5;
                if (bits >= 8) {
                    c = (x >> (bits - 8)) & 0xff;
                    out_buf.push(c);
                    bits -= 8;
                }
            }
        }
        // remaining bits are < 8
        if (bits>0) {
            c = ((x << (8 - bits)) & 0xff) >> (8 - bits);
            // Don't append a null terminator.
            // See the comment at the top about why this sucks.
            if (c!==0) {
                out_buf.push(c);
            }
        }
        return Uint8Array.from(out_buf);
    }
};


// r3dir Javascript encoder/decoder

const MAX_SUBDOMAIN_LENGTH = 63;
const IGNORE_PART_SEP = "--";
const MAX_DOMAIN_LENGTH = 253
const MAX_COMPRESSION_TARGET_SIZE = 1024;

function chunkString(string, length) {
    const chunks = [];
    for (let i = 0; i < string.length; i += length) {
        chunks.push(string.substring(i, i + length));
    }
    return chunks;
}

function b32encodeDns(string) {
    var out_buf = new Uint8Array(string.length); 
    var out_len = unishox2_compress_simple(string, string.length, out_buf);
    const encoded = base32.encode(out_buf.slice(0, out_len)).replaceAll('=', '').toLowerCase();
    
    return chunkString(encoded, MAX_SUBDOMAIN_LENGTH);
}

function b32decodeDns(subdomains) {
    const encodedString = subdomains.join('');
    const padLength = Math.ceil(encodedString.length / 8) * 8 - encodedString.length;
    const encodedTarget = encodedString + '='.repeat(padLength);
    var out_buf = base32.decode(encodedTarget)
    var out_str = unishox2_decompress_simple(out_buf, out_buf.length);
    return out_str
    
}

function isTooLongTargetError(encodedSubdomains) {
    for (const domain of encodedSubdomains) {
        if (domain.startsWith("too-long-target-")) {
            return domain.replace("too-long-target-", "");
        }
    }
    return false;
}

function encode(target, statusCode, mainDomain, ignorePart = null, httpsEnforced = false, silentMode = false) {
    const subdomains = b32encodeDns(target).join('.');
    let encodedDomain = `${subdomains}.${statusCode}.${mainDomain}`;

    try {
        if(httpsEnforced){
          if (ignorePart || subdomains.length > MAX_SUBDOMAIN_LENGTH) {
            throw new Error("The target length is longer than maximum allowed for HTTPS mode. Remove ignoring part, or short the target.");
          }
        } else if (ignorePart) {
            encodedDomain = `${ignorePart}.${IGNORE_PART_SEP}.${encodedDomain}`;
        }

        if (encodedDomain.length > MAX_DOMAIN_LENGTH) {
            throw new Error("The target length is longer than maximum allowed.");
        }
    } catch (error) {
        if (!silentMode) {
            throw error;
        }
        const targetHash = hex_sha1(target);
        return `too-long-target-${targetHash}.${statusCode}.${mainDomain}`;
    }

    return encodedDomain;
}

function decode(domain, mainDomain) {
    const subdomains = domain.split('.');
    const mainDomainChunkCount = mainDomain.split('.').length;
    const subdomainsWithoutMain = subdomains.slice(0, -mainDomainChunkCount);
    let startOfEncodedTarget = 0;
    if (subdomainsWithoutMain.includes(IGNORE_PART_SEP)) {
        startOfEncodedTarget = subdomainsWithoutMain.indexOf(IGNORE_PART_SEP) + 1;
    }

    const encodedSubdomains = subdomainsWithoutMain.slice(startOfEncodedTarget);
    const targetUrlHash = isTooLongTargetError(encodedSubdomains);
    if (targetUrlHash) {
        throw new Error(`The target length has been too long for encoder. Target's SHA-1: ${targetUrlHash}`);
    }

    let statusCode;
    
    statusCode = parseInt(encodedSubdomains[encodedSubdomains.length - 1], 10);
    if (isNaN(statusCode)) {
            throw new Error("Can't read status code.");
    }
  
    if (statusCode < 200 || statusCode >= 600) {
        throw new Error("Status code is not in [200, 600) range");
    }

    try {
        const target = b32decodeDns(encodedSubdomains.slice(0, -1));
        return [target, statusCode];
    } catch (e) {
        throw new Error("Base32-encoded target decoding error");
    }
}

// Node.js env detection
if ((typeof process !== 'undefined') && (process.release.name === 'node')){
  module.exports = {
    encode,
    decode
  };
}

const result = decode("62epax54k4z4o2wubwlx57p374.302.r3dir.me", 'r3dir.me');

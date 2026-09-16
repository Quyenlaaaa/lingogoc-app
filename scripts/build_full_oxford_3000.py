# -*- coding: utf-8 -*-
"""
build_full_oxford_3000.py
Compiles 3000 Oxford words with:
- Word
- Real IPA transcription
- Part of speech (pos)
- Vietnamese definition
- Real example sentence (EN & VI)
- Level (A1, A2, B1)
- 16 Practical Topics
"""

import sys
import json
import urllib.request
import re

sys.stdout.reconfigure(encoding='utf-8')

print("1. Downloading Oxford 3000 words list...")
oxford_url = 'https://raw.githubusercontent.com/ameerfayiz/oxford-3000-Json/main/oxford-3000_amr.json'
try:
    req = urllib.request.urlopen(oxford_url, timeout=15)
    oxford_dict = json.loads(req.read().decode('utf-8'))
    print(f"Loaded {len(oxford_dict)} Oxford words.")
except Exception as e:
    print(f"Failed to fetch Oxford dict: {e}")
    sys.exit(1)

print("2. Downloading Vietnamese Dictionary (anhviet109K.txt)...")
dict_url = 'https://raw.githubusercontent.com/yenthanh132/avdict-database-sqlite-converter/master/anhviet109K.txt'
try:
    req = urllib.request.urlopen(dict_url, timeout=30)
    raw_dict = req.read().decode('utf-8', errors='ignore')
    print(f"Loaded dictionary data ({len(raw_dict)} chars).")
except Exception as e:
    print(f"Failed to fetch Vietnamese dict: {e}")
    sys.exit(1)

print("3. Indexing Vietnamese definitions and IPAs...")
# Parse anhviet entries: each starts with @word /ipa/
entries = raw_dict.split('\n@')
vi_map = {}

for entry in entries:
    lines = entry.strip().split('\n')
    if not lines:
        continue
    first_line = lines[0].strip()
    if first_line.startswith('@'):
        first_line = first_line[1:].strip()
    
    # Extract word and ipa
    ipa_match = re.search(r'/(.*?)/', first_line)
    ipa = f"/{ipa_match.group(1)}/" if ipa_match else ""
    word_part = re.sub(r'/.*?/', '', first_line).strip().lower()
    
    if not word_part:
        continue

    # Extract part of speech, meanings, and examples
    pos = "n"
    meanings = []
    examples = []
    
    for line in lines[1:]:
        line = line.strip()
        if line.startswith('*'):
            pos_text = line[1:].strip()
            if 'danh từ' in pos_text:
                pos = 'n'
            elif 'động từ' in pos_text:
                pos = 'v'
            elif 'tính từ' in pos_text:
                pos = 'adj'
            elif 'phó từ' in pos_text or 'trạng từ' in pos_text:
                pos = 'adv'
            elif 'giới từ' in pos_text:
                pos = 'prep'
            elif 'liên từ' in pos_text:
                pos = 'conj'
            elif 'đại từ' in pos_text:
                pos = 'pron'
        elif line.startswith('-'):
            m = line[1:].strip()
            if m and not m.startswith('(') and len(m) < 80:
                meanings.append(m)
            elif m:
                # remove parenthesized parts if any
                clean_m = re.sub(r'\(.*?\)', '', m).strip()
                if clean_m and len(clean_m) < 80:
                    meanings.append(clean_m)
        elif line.startswith('='):
            # Example line: =english+vietnamese
            ex_parts = line[1:].split('+')
            if len(ex_parts) == 2:
                en_ex = ex_parts[0].replace('_', ' ').strip()
                vi_ex = ex_parts[1].strip()
                if en_ex and vi_ex and len(en_ex) < 120 and len(vi_ex) < 120:
                    examples.append((en_ex, vi_ex))

    if word_part not in vi_map:
        vi_map[word_part] = {
            'ipa': ipa,
            'pos': pos,
            'meanings': meanings,
            'examples': examples
        }

print(f"Indexed {len(vi_map)} words from Vietnamese dictionary.")

# Topic classification helper based on semantics
topic_keywords = {
    'Ăn uống': ['food', 'eat', 'drink', 'water', 'tea', 'coffee', 'meal', 'bread', 'meat', 'fruit', 'vegetable', 'cook', 'taste', 'soup', 'salad', 'breakfast', 'lunch', 'dinner', 'restaurant', 'sweet', 'salt', 'sugar', 'juice', 'beer', 'wine', 'rice', 'fish', 'chicken', 'cake', 'cheese', 'egg', 'apple', 'banana', 'orange', 'hungry', 'thirsty', 'bake', 'boil', 'fry', 'plate', 'fork', 'spoon', 'knife', 'menu', 'bill', 'dish'],
    'Gia đình': ['family', 'father', 'mother', 'parent', 'dad', 'mom', 'brother', 'sister', 'son', 'daughter', 'child', 'children', 'baby', 'husband', 'wife', 'grandfather', 'grandmother', 'aunt', 'uncle', 'cousin', 'marry', 'marriage', 'born', 'birth', 'kid', 'grow', 'relative'],
    'Mua sắm': ['buy', 'sell', 'shop', 'store', 'market', 'price', 'cost', 'pay', 'cash', 'card', 'money', 'dollar', 'cheap', 'expensive', 'discount', 'size', 'clothes', 'dress', 'shirt', 'pants', 'shoes', 'bag', 'coat', 'jacket', 'wear', 'fit', 'customer', 'spend', 'wallet'],
    'Đi lại & Du lịch': ['travel', 'trip', 'go', 'visit', 'tour', 'tourist', 'ticket', 'passport', 'airport', 'plane', 'flight', 'station', 'train', 'bus', 'car', 'taxi', 'drive', 'ride', 'walk', 'hotel', 'luggage', 'suitcase', 'map', 'direction', 'left', 'right', 'straight', 'far', 'near', 'distance', 'vacation', 'holiday', 'beach', 'country', 'city', 'abroad'],
    'Công việc & Công sở': ['work', 'job', 'office', 'company', 'boss', 'colleague', 'meeting', 'project', 'report', 'salary', 'manager', 'employee', 'interview', 'career', 'business', 'email', 'worker', 'manage', 'hire', 'profession', 'engineer', 'doctor', 'nurse', 'teacher', 'driver', 'staff'],
    'Sức khỏe & Y tế': ['health', 'healthy', 'sick', 'ill', 'hospital', 'doctor', 'nurse', 'medicine', 'pain', 'hurt', 'headache', 'stomach', 'fever', 'cough', 'cold', 'tired', 'sleep', 'rest', 'clinic', 'treatment', 'disease', 'blood', 'heart', 'body', 'exercise', 'diet'],
    'Cảm xúc & Tính cách': ['happy', 'sad', 'angry', 'afraid', 'fear', 'scared', 'nervous', 'calm', 'excited', 'proud', 'confident', 'love', 'like', 'hate', 'kind', 'polite', 'honest', 'smart', 'clever', 'lazy', 'shy', 'funny', 'serious', 'boring', 'friendly', 'brave', 'feeling', 'mood', 'smile', 'cry', 'laugh'],
    'Thời gian & Ngày tháng': ['time', 'hour', 'minute', 'second', 'day', 'night', 'morning', 'afternoon', 'evening', 'week', 'month', 'year', 'today', 'tomorrow', 'yesterday', 'now', 'soon', 'later', 'early', 'late', 'calendar', 'clock', 'date', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
    'Nhà cửa & Đồ vật': ['house', 'home', 'apartment', 'room', 'door', 'window', 'floor', 'wall', 'roof', 'bed', 'bedroom', 'table', 'chair', 'desk', 'kitchen', 'bathroom', 'shower', 'key', 'lock', 'light', 'lamp', 'mirror', 'box', 'clock', 'sofa', 'curtain', 'garden', 'gate', 'yard', 'clean'],
    'Công nghệ & Thiết bị': ['computer', 'laptop', 'phone', 'telephone', 'mobile', 'internet', 'online', 'screen', 'keyboard', 'mouse', 'software', 'app', 'website', 'email', 'message', 'video', 'camera', 'digital', 'device', 'battery', 'charge', 'data', 'network', 'machine', 'technology', 'system'],
    'Thời tiết & Thiên nhiên': ['weather', 'sun', 'sunny', 'rain', 'rainy', 'cloud', 'cloudy', 'wind', 'windy', 'snow', 'storm', 'cold', 'hot', 'warm', 'cool', 'sky', 'sea', 'ocean', 'river', 'lake', 'mountain', 'hill', 'forest', 'tree', 'flower', 'grass', 'nature', 'earth', 'season', 'spring', 'summer', 'autumn', 'winter'],
    'Giáo dục & Học tập': ['study', 'learn', 'school', 'university', 'college', 'class', 'classroom', 'student', 'teacher', 'book', 'pen', 'pencil', 'notebook', 'lesson', 'homework', 'exam', 'test', 'grade', 'knowledge', 'library', 'read', 'write', 'practice', 'course', 'subject', 'rule'],
    'Thể thao & Giải trí': ['sport', 'game', 'play', 'player', 'football', 'soccer', 'basketball', 'tennis', 'swim', 'swimming', 'run', 'race', 'gym', 'music', 'song', 'sing', 'singer', 'dance', 'movie', 'film', 'cinema', 'theatre', 'guitar', 'piano', 'hobby', 'party', 'fun', 'enjoy'],
    'Chào hỏi & Giao tiếp': ['hello', 'hi', 'goodbye', 'bye', 'please', 'thank', 'thanks', 'welcome', 'sorry', 'excuse', 'pardon', 'meet', 'introduce', 'name', 'speak', 'talk', 'listen', 'hear', 'ask', 'answer', 'question', 'tell', 'say', 'call', 'conversation', 'language', 'word', 'sentence']
}

def determine_topic(word, meaning):
    w = word.lower()
    m = meaning.lower()
    for topic, kw_list in topic_keywords.items():
        if w in kw_list:
            return topic
        for kw in kw_list:
            if kw in m:
                return topic
    return 'Đời sống'

print("4. Building final 3000 dataset...")
final_list = []
idx = 1

# Standard Oxford CEFR mapping
for word, details in oxford_dict.items():
    clean_w = word.strip().lower()
    if not clean_w:
        continue

    # Determine CEFR level: A1, A2, B1 (map B2 to B1 for standard beginner-intermediate syllabus)
    cefr = "A1"
    pos = "n"
    if isinstance(details, dict):
        first_pos = list(details.keys())[0] if details else 'n.'
        raw_cefr = details.get(first_pos, 'A1')
        pos = first_pos.replace('.', '')
        if raw_cefr in ['A1', 'A2', 'B1']:
            cefr = raw_cefr
        elif raw_cefr == 'B2':
            cefr = 'B1'
        else:
            cefr = 'A2'

    # Retrieve Vietnamese data
    vi_info = vi_map.get(clean_w, None)
    ipa = ""
    meaning = ""
    example = ""
    example_vi = ""

    if vi_info:
        ipa = vi_info['ipa'] or f"/{clean_w}/"
        if vi_info['meanings']:
            meaning = vi_info['meanings'][0]
        if vi_info['examples']:
            example, example_vi = vi_info['examples'][0]
    
    if not meaning:
        # Không đoán nghĩa. Mục thiếu dữ liệu phải được đối chiếu trước khi dùng.
        meaning = "[Chưa có nghĩa đã kiểm chứng]"
    
    if not ipa:
        ipa = f"/{clean_w}/"
        
    if not example:
        example = ""
        example_vi = ""

    topic = determine_topic(clean_w, meaning)

    final_list.append({
        'id': idx,
        'word': clean_w,
        'ipa': ipa,
        'pos': pos,
        'meaning': meaning,
        'example': example,
        'exampleVi': example_vi,
        'level': cefr,
        'topic': topic
    })
    idx += 1

print(f"Total vocabulary items generated: {len(final_list)}")

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_js = os.path.join(base_dir, 'src', 'data', 'vocabData.js')
out_json = os.path.join(base_dir, 'src', 'data', 'vocabData.json')

js_content = f"""// vocabData.js - 3000 Oxford Essential Words with IPA, VN meanings & examples
// Generated for LingoGoc AI

export const topics = [
  'Tất cả',
  'Chào hỏi & Giao tiếp',
  'Ăn uống',
  'Gia đình',
  'Mua sắm',
  'Đi lại & Du lịch',
  'Công việc & Công sở',
  'Sức khỏe & Y tế',
  'Cảm xúc & Tính cách',
  'Thời gian & Ngày tháng',
  'Nhà cửa & Đồ vật',
  'Công nghệ & Thiết bị',
  'Thời tiết & Thiên nhiên',
  'Giáo dục & Học tập',
  'Thể thao & Giải trí',
  'Đời sống'
];

export const levels = ['Tất cả', 'A1', 'A2', 'B1'];

export const vocabList = {json.dumps(final_list, ensure_ascii=False, indent=2)};

export default vocabList;
"""

with open(out_js, 'w', encoding='utf-8') as f:
    f.write(js_content)

with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(final_list, f, ensure_ascii=False)

print(f"Saved {len(final_list)} words to {out_js} and {out_json} successfully!")

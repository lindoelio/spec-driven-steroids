# @mycompany/utils

Common utilities for our projects.

## Installation

```bash
npm install @mycompany/utils
```

## Usage

```javascript
import { capitalize, pluralize } from '@mycompany/utils';

capitalize('hello');  // 'Hello'
pluralize('apple', 2);  // '2 apples'
```

## API

### capitalize(str)

Capitalizes the first letter of a string.

### pluralize(word, count)

Returns the word with 's' appended if count is not 1.

## Changelog

### 2.0.0

- **Breaking**: Removed `capitalizeWords()` function
- Added `pluralize()` function
- Dropped Node 14 support

### 1.0.0

- Initial release

//go:build windows

package validate

import "os"

// isTerminal reports whether the file is a terminal.
func isTerminal(file *os.File) bool {
	info, err := file.Stat()
	if err != nil {
		return false
	}
	return info.Mode()&os.ModeCharDevice != 0
}

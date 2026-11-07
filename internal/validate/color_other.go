//go:build !linux && !darwin && !windows

package validate

import "os"

// isTerminal reports whether the file is a terminal.
func isTerminal(file *os.File) bool {
	return false
}

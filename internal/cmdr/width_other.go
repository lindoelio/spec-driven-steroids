//go:build !unix && !windows

package cmdr

import "os"

// terminalWidth returns the number of columns of the terminal behind the
// file, or zero when the file is not a terminal.
//
// The platforms that do not report the size of the terminal fall back to the
// default width, the way commander does when the output is not a terminal.
func terminalWidth(file *os.File) int {
	return 0
}

// IsTerminal reports whether the file is a terminal.
//
// A character device alone is not enough: the null device is one, and a
// process reading from it is not interactive. This platform reports no
// terminal, so it is never interactive.
func IsTerminal(file *os.File) bool {
	return false
}

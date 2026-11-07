//go:build !unix

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

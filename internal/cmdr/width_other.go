//go:build !unix

package cmdr

import (
	"os"
	"runtime"
	"syscall"
)

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
// A character device alone is not enough: NUL is one, and a process reading
// from it is not interactive. On Windows the console mode query only succeeds
// on a real console; elsewhere nothing is a terminal.
func IsTerminal(file *os.File) bool {
	if file == nil || runtime.GOOS != "windows" {
		return false
	}
	var mode uint32
	return syscall.GetConsoleMode(syscall.Handle(file.Fd()), &mode) == nil
}

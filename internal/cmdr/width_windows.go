//go:build windows

package cmdr

import (
	"os"
	"syscall"
)

// terminalWidth returns the number of columns of the terminal behind the
// file, or zero when the file is not a terminal.
//
// Windows does not report the size through the portable call used elsewhere,
// so the help keeps the default width.
func terminalWidth(file *os.File) int {
	return 0
}

// IsTerminal reports whether the file is a terminal.
//
// A character device alone is not enough: NUL is one, and a process reading
// from it is not interactive. The console mode query only succeeds on a real
// console.
func IsTerminal(file *os.File) bool {
	if file == nil {
		return false
	}
	var mode uint32
	return syscall.GetConsoleMode(syscall.Handle(file.Fd()), &mode) == nil
}

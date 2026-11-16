//go:build unix && !linux && !darwin

package cmdr

import "os"

// terminalIsTerminal reports whether the file is a terminal.
//
// The other Unix systems do not share a terminal-attribute request here, so
// the window size is the best signal available.
func terminalIsTerminal(file *os.File) bool {
	return terminalWidth(file) > 0
}

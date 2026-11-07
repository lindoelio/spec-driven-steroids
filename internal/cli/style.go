package cli

import (
	"os"
	"strings"
)

// The terminal styling mirrors the previous release: colours are used only
// when the output is a terminal and NO_COLOR is not set.
var colorEnabled = detectColor()

func detectColor() bool {
	if _, ok := os.LookupEnv("NO_COLOR"); ok {
		return false
	}
	if os.Getenv("TERM") == "dumb" {
		return false
	}
	info, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return info.Mode()&os.ModeCharDevice != 0
}

const (
	resetSeq   = "\x1b[0m"
	boldSeq    = "\x1b[1m"
	redSeq     = "\x1b[31m"
	greenSeq   = "\x1b[32m"
	yellowSeq  = "\x1b[33m"
	blueSeq    = "\x1b[34m"
	magentaSeq = "\x1b[35m"
	cyanSeq    = "\x1b[36m"
	graySeq    = "\x1b[90m"
)

func style(seq, value string) string {
	if !colorEnabled {
		return value
	}
	return seq + value + resetSeq
}

func bold(value string) string      { return style(boldSeq, value) }
func red(value string) string       { return style(redSeq, value) }
func green(value string) string     { return style(greenSeq, value) }
func yellow(value string) string    { return style(yellowSeq, value) }
func cyan(value string) string      { return style(cyanSeq, value) }
func gray(value string) string      { return style(graySeq, value) }
func boldCyan(value string) string  { return style(boldSeq+cyanSeq, value) }
func boldGreen(value string) string { return style(boldSeq+greenSeq, value) }
func boldYellow(value string) string {
	return style(boldSeq+yellowSeq, value)
}

// stripANSI removes the escape sequences from a string, so that the machine
// readable output never carries them.
func stripANSI(value string) string {
	var builder strings.Builder
	for i := 0; i < len(value); i++ {
		if value[i] == 0x1b {
			for i < len(value) && value[i] != 'm' {
				i++
			}
			continue
		}
		builder.WriteByte(value[i])
	}
	return builder.String()
}

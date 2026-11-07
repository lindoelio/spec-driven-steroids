package pack

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
)

// The MiniMax Code marketplace requires the icon of a plugin to be a file
// inside the package, so the package carries one.
//
// The mark is drawn from the shape of the package, so the same package always
// carries the same icon and a package never depends on a file that lives
// somewhere else.
const (
	iconSize   = 512
	iconMargin = 96
)

// packageIcon renders the icon of the package as a PNG.
func packageIcon() ([]byte, error) {
	canvas := image.NewRGBA(image.Rect(0, 0, iconSize, iconSize))

	background := color.RGBA{R: 0x10, G: 0x14, B: 0x1C, A: 0xFF}
	mark := color.RGBA{R: 0x7A, G: 0xA2, B: 0xF7, A: 0xFF}
	muted := color.RGBA{R: 0x3D, G: 0x59, B: 0x99, A: 0xFF}

	// The background is a square with rounded corners.
	for y := 0; y < iconSize; y++ {
		for x := 0; x < iconSize; x++ {
			if insideRoundedSquare(x, y) {
				canvas.Set(x, y, background)
			}
		}
	}

	// The mark is three sheets of a specification, the widest one at the
	// bottom.
	sheets := []struct {
		top    int
		height int
		width  int
		color  color.RGBA
	}{
		{top: iconMargin + 40, height: 56, width: iconSize - 2*iconMargin, color: mark},
		{top: iconMargin + 140, height: 56, width: iconSize - 2*iconMargin - 72, color: muted},
		{top: iconMargin + 240, height: 56, width: iconSize - 2*iconMargin - 144, color: muted},
	}
	for _, sheet := range sheets {
		fillRect(canvas, sheet.top, sheet.top+sheet.height, iconMargin, iconMargin+sheet.width, sheet.color)
	}

	var buffer bytes.Buffer
	if err := png.Encode(&buffer, canvas); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

// insideRoundedSquare reports whether a point belongs to the square with
// rounded corners that carries the background of the icon.
func insideRoundedSquare(x, y int) bool {
	const radius = 96
	left, top := radius, radius
	right, bottom := iconSize-radius-1, iconSize-radius-1

	if x < left && y < top {
		return (left-x)*(left-x)+(top-y)*(top-y) <= radius*radius
	}
	if x > right && y < top {
		return (x-right)*(x-right)+(top-y)*(top-y) <= radius*radius
	}
	if x < left && y > bottom {
		return (left-x)*(left-x)+(y-bottom)*(y-bottom) <= radius*radius
	}
	if x > right && y > bottom {
		return (x-right)*(x-right)+(y-bottom)*(y-bottom) <= radius*radius
	}
	return true
}

// fillRect paints a rectangle of the canvas.
func fillRect(canvas *image.RGBA, top, bottom, left, right int, value color.RGBA) {
	for y := top; y < bottom; y++ {
		for x := left; x < right; x++ {
			canvas.Set(x, y, value)
		}
	}
}

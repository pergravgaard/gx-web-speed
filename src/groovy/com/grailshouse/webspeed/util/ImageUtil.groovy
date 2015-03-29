package com.grailshouse.webspeed.util

import com.mortennobel.imagescaling.AdvancedResizeOp
import com.mortennobel.imagescaling.ResampleFilters
import com.mortennobel.imagescaling.ResampleOp

import javax.imageio.ImageIO
import java.awt.image.BufferedImage

class ImageUtil {

	// not intended for subclassing
	private ImageUtil() {
		super()
	}

	static BufferedImage getBufferedImage(byte[] bytes) {
		InputStream is = new BufferedInputStream(new ByteArrayInputStream(bytes))
		return ImageIO.read(is)
	}

	/**
	 * Scales the buffered image into a new buffered image by using the code from the Java Image Scaling Project: http://code.google.com/p/java-image-scaling
	 * The returned image is not cropped, but the original ratio (height/width) of the image is preserved.
	 * So if you call this method with width and height arguments that would result in another ratio, either the width argument or height argument is adjusted.
	 * @param image
	 * @param newWidth
	 * @param newHeight
	 * @return
	 */
	static BufferedImage createZoomImage(final BufferedImage image, final Integer zoomWidth, final Integer zoomHeight) {
        //long start = System.currentTimeMillis()
		double ratio = image.height / image.width
		int newWidth = zoomWidth != null ? zoomWidth.intValue() : 0
		int newHeight = zoomHeight != null ? zoomHeight.intValue() : 0
		assert (newHeight > 0 || newWidth > 0)
		if (newHeight <= 0) {
			newHeight = ratio * newWidth
		}
		if (newWidth <= 0) {
			newWidth = newHeight / ratio
		}
		double newRatio = newHeight / newWidth
		// preserve the original ratio by keeping width constant
		int adjustedWidth = newWidth
		int adjustedHeight = newHeight
		if (newRatio != ratio) { // keep width constant
			adjustedHeight = (int) (ratio * adjustedWidth)
		}
//		double adjustedRatio = adjustedHeight / adjustedWidth
//		println "orig width: ${image.width} - orig height: ${image.height}"
//		println "new width: $newWidth - new height: $newHeight"
//		println "adj width: $adjustedWidth - adj height: $adjustedHeight"
//		println "ratio: $ratio - new ratio: $newRatio"
//		println "adjusted ratio: $adjustedRatio"
		ResampleOp resampleOp = new ResampleOp(adjustedWidth, adjustedHeight)
		resampleOp.setFilter(ResampleFilters.getLanczos3Filter())
		resampleOp.setUnsharpenMask(AdvancedResizeOp.UnsharpenMask.Normal)
		resampleOp.filter(image, null)
	}

	static BufferedImage createCroppedZoomImage(BufferedImage image, int newWidth, int newHeight) {
		if (image) {
			double ratio = (double) image.getHeight() / (double) image.getWidth()
			double newRatio = (double) newHeight / (double) newWidth
			int iType = image.getType()
			if (iType == BufferedImage.TYPE_CUSTOM) { // PNG files goes here
				iType = BufferedImage.TYPE_INT_ARGB_PRE
			}
			BufferedImage thumbnail = new BufferedImage(newWidth, newHeight, iType)
			int cropWidth = image.getWidth()
			int cropHeight = image.getHeight()
			int dx = 0
			int dy = 0
			if (newRatio <= ratio) { // keep width constant
				cropHeight = (int) (newRatio * cropWidth)
				dy = (image.getHeight() - cropHeight) / 2
			} else { // keep height constant
				cropWidth = (int) (cropHeight / newRatio)
				dx = (image.getWidth() - cropWidth) / 2
			}
			if (thumbnail.createGraphics().drawImage(image, 0, 0, newWidth, newHeight, dx, dy, cropWidth + dx, cropHeight + dy, null)) {
				return thumbnail
			}
		}
		return null
	}

}

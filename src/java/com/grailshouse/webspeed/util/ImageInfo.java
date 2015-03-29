package com.grailshouse.webspeed.util;

import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.FileImageOutputStream;

import org.apache.log4j.Logger;

import com.mortennobel.imagescaling.AdvancedResizeOp;
import com.mortennobel.imagescaling.ResampleFilters;
import com.mortennobel.imagescaling.ResampleOp;

/**
 * Class to manage images in JPG format.
 *
 * @author stivlo
 *
 */
public class ImageInfo {

	/** JPEG quality. */
	private static final float JPEG_QUALITY = 0.90f;

	/** Source image buffer. */
	private BufferedImage sourceImage;

	/** Destination image buffer. */
	private BufferedImage destImage;

	/** Length in bytes of the source image. */
	private long sourceSize;

	/** Logger instance for this class. */
	private static final Logger LOG = Logger.getLogger(ImageInfo.class);

	/**
	 * Read an image to be manipulated from a file.
	 *
	 * @param sourceFileName
	 *                the fileName of the original image
	 * @throws IOException
	 *                 in case of problems reading the image
	 */
	public final void read(final String sourceFileName) throws IOException {
		File sourceFile = new File(sourceFileName);
		sourceSize = sourceFile.length();
		sourceImage = ImageIO.read(sourceFile);
		if (sourceImage == null) {
			throw new IOException("Problems reading image '" + sourceFileName + "'");
		}
	}

	/**
	 * Read an image to be manipulated from an InputStream.
	 *
	 * @param inputStream
	 *                the InputStream where to read from
	 * @throws IOException
	 *                 in case of problems
	 */
	//        public final void read(final InputStream inputStream) throws IOException {
	//                sourceImage = ImageIO.read(inputStream);
	//                if (sourceImage == null) {
	//                        throw new IOException("Problems reading image input stream");
	//                }
	//        }

	/**
	 * Read an image to be manipulated from a byte array.
	 *
	 * @param byteArray
	 *                the byte array containing the image
	 * @throws IOException
	 *                 in case of problems
	 */
	public final void read(final byte[] byteArray) throws IOException {
		sourceSize = byteArray.length;
		sourceImage = ImageIO.read(new ByteArrayInputStream(byteArray));
		if (sourceImage == null) {
			throw new IOException("Problems decoding the image");
		}
		LOG.debug("read() " + getSourceDimension());
	}

	/**
	 * Scale an image to specified dimensions, stretching it if required.
	 *
	 * @param newWidth
	 *                suggested width
	 * @param newHeight
	 *                suggested height
	 * @throws IOException
	 *                 in case source image is not present
	 */
	private void scale(final int newWidth, final int newHeight) throws IOException {
		LOG.debug("scale() " + getSourceDimension() + " => " + newWidth + "x" + newHeight);
		if (sourceImage == null) {
			throw new IOException("sourceImage corrupted or not found");
		}
		ResampleOp resampleOp = new ResampleOp(newWidth, newHeight);
		resampleOp.setFilter(ResampleFilters.getLanczos3Filter());
		resampleOp.setUnsharpenMask(AdvancedResizeOp.UnsharpenMask.Normal);
		destImage = resampleOp.filter(sourceImage, null);
	}

	/**
	 * Scale an image by width. The new width, is the one specified, while
	 * the height will be calculated proportionally.
	 *
	 * @param newWidth
	 *                suggested width
	 * @throws IOException
	 *                 in case source image is not present
	 */
	public final void scaleByWidth(final int newWidth) throws IOException {
		Dimension dimension = getSourceDimension();
		int newHeight = (int) Math.round(dimension.height * (newWidth / dimension.getWidth()));
		scale(newWidth, newHeight);
	}

	/**
	 * Scale an image by width. The new width, is the one specified, while
	 * the height will be calculated proportionally.
	 *
	 * @param newHeight
	 *                suggested height
	 * @throws IOException
	 *                 in case source image is not present
	 */
	public final void scaleByHeight(final int newHeight) throws IOException {
		Dimension dimension = getSourceDimension();
		int newWidth = (int) Math.round(dimension.width * (newHeight / dimension.getHeight()));
		scale(newWidth, newHeight);
	}

	/**
	 * Scale an image. In case the proportions are not right, the a white
	 * band will be inserted either at the top and bottom or on the left and
	 * right.
	 *
	 * @param newDimension
	 *                suggested dimensions (width and height)
	 * @throws IOException
	 *                 in case source image is not present
	 */
	public final void scaleWhiteBand(final Dimension newDimension) throws IOException {
		LOG.debug("scaleWhiteBand " + getSourceDimension() + " => " + newDimension);
		scaleBoundingBox(newDimension);
		BufferedImage canvas = new BufferedImage(newDimension.width, newDimension.height,
				BufferedImage.TYPE_INT_RGB);
		Graphics2D canvasGraph = canvas.createGraphics();
		canvasGraph.setColor(Color.WHITE);
		canvasGraph.fillRect(0, 0, newDimension.width, newDimension.height);
		int startingX = (int) Math.round((newDimension.width - destImage.getWidth()) / 2.0);
		int startingY = (int) Math.round((newDimension.height - destImage.getHeight()) / 2.0);
		canvasGraph.drawImage(destImage, null, startingX, startingY);
		canvasGraph.dispose();
		destImage = canvas;
	}

	/**
	 * Scale an image to fit a bounding box of dimensions newDimension.
	 *
	 * @param newDimension
	 *                dimensions of the bounding box
	 * @throws IOException
	 *                 in case source image is not present
	 */
	public final void scaleBoundingBox(final Dimension newDimension) throws IOException {
		Dimension dimension = getSourceDimension();
		double ratio = dimension.getWidth() / dimension.getHeight();
		double newRatio = newDimension.getWidth() / newDimension.getHeight();
		if (ratio > newRatio) {
			scaleByWidth(newDimension.width);
		} else {
			scaleByHeight(newDimension.height);
		}
	}

	/**
	 * Return the dimensions (width and height) of a source image previously
	 * read.
	 *
	 * @return image Dimensions
	 */
	public final Dimension getSourceDimension() {
		return new Dimension(sourceImage.getWidth(), sourceImage.getHeight());
	}

	/**
	 * Return the dimensions (width and height) of the destination image
	 * computed.
	 *
	 * @return image Dimensions
	 */
	public final Dimension getDestinationDimension() {
		return new Dimension(destImage.getWidth(), destImage.getHeight());
	}

	/**
	 * Write the current computed image as JPEG file setting the compression
	 * quality.
	 *
	 * @param destFile
	 *                destination file (absolute or relative path)
	 * @param quality
	 *                a float between 0 and 1, where 1 means uncompressed.
	 * @throws IOException
	 *                 in case of problems writing the file
	 */
	private void writeJpeg(final String destFile, final float quality) throws IOException {
		ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
		ImageWriteParam param = writer.getDefaultWriteParam();
		param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
		param.setCompressionQuality(quality);
		FileImageOutputStream output = new FileImageOutputStream(new File(destFile));
		writer.setOutput(output);
		IIOImage iioImage = new IIOImage(destImage, null, null);
		writer.write(null, iioImage, param);
		writer.dispose();
	}

	/**
	 * Write the current image as JPEG file with the default compression
	 * quality.
	 *
	 * @param destFile
	 *                destination file (absolute or relative path)
	 * @throws IOException
	 *                 in case of problems writing the file
	 */
	public final void writeJpeg(final String destFile) throws IOException {
		writeJpeg(destFile, JPEG_QUALITY);
	}

	/**
	 * The size in bytes of the source image file.
	 *
	 * @return size in bytes of the source image
	 */
	public final long getSourceSize() {
		return sourceSize;
	}

}

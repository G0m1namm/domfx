export async function captureFailureEvidence(page, consumer, screenshotPath) {
  try {
    consumer.pageReport = await page.evaluate(
      () => document.querySelector('#report')?.textContent ?? null,
    );
  } catch (error) {
    consumer.errors.push(`Failure report unavailable: ${error}`);
  }
  try {
    await page.screenshot({ path: screenshotPath });
  } catch (error) {
    consumer.errors.push(`Failure screenshot unavailable: ${error}`);
  }
}

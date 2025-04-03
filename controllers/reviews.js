const Review = require("../Models/review.js")
const Listing = require("../Models/listing.js")

module.exports.create = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    console.log(newReview);

    listing.reviews.push(newReview);
    await newReview.save()
    await listing.save()
    req.flash("success", "New Review Created")
    res.redirect(`/listings/${listing._id}`)

}

module.exports.delete = async (req, res) => {
    let { id, reviewId } = req.params;
    await Review.findByIdAndDelete(reviewId)
    Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } })
    req.flash("success", "Review Deleted")
    res.redirect(`/listings/${id}`);
}
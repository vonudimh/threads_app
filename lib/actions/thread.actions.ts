"use server";

import { FilterQuery, SortOrder } from "mongoose";
import { revalidatePath } from "next/cache";

//import Community from "../models/community.model";
import Thread from "../models/thread.model";
import User from "../models/user.model";

import { connectToDB } from "../mongoose";
import { skip } from "node:test";


interface Params{
    text:string,
    author:string,
    communityId:string |null,
    path:string,
}

export async function createThread({text, author, communityId, path}: Params){

    try{
        connectToDB();

        const createdThread = await Thread.create({
            text,
            author,
            community:null,
        });
    
        //update user model
        await User.findByIdAndUpdate(author,{
            $push:{
                threads:createdThread._id
            }
        })
    
        revalidatePath(path);
    }catch(error: any){
        throw new Error(`Error creating thread: ${error.message}`)
    }
    

}


export async function fetchPosts(pageNumber=1, pageSize=20) {
    await connectToDB();

    //calculate the number of posts to skip depending on which page were on
    const skipAmount = (pageNumber - 1) * pageSize;

    //fetch the posts that have no parents (top level threads...)
    const postsQuery = Thread.find({parentId: {$in:[null, undefined]}})
    .sort({createdAt:'desc'})
    .skip(skipAmount)
    .limit(pageSize)
    .populate({path:'author', model:User})
    .populate({path:'children', populate:{path:'author', model:User, select:"_id name parentId image"
    }

   })

   const totalPostsCount = await Thread.countDocuments({
    parentId: {$in:[null, undefined]}
   })

   const posts = await postsQuery.exec();

   const isNext = totalPostsCount > skipAmount + posts.length;

   return {posts, isNext}




}


export async function fetchThreadById(id:string){
    await connectToDB();

    try{
        
        //TODO: populate community
        const thread = await Thread.findById(id)
        .populate({
            path:'author',
            model:User,
            select:"_id id name image"
            })
            .populate({
                path:'children',
                populate:[
                {
                    path:'author',
                    model:User,
                    select:"_id id name parentId image"
                },
                {
                    path:'children',
                    model:Thread,
                    populate:{
                        path:'author',
                        model:User,
                        select:"_id id name parentId image"
                    }
                }
            ]
        }).exec();
        return thread;
    }catch(error: any){
        throw new Error(`Error fetching thread by id: ${error.message}`)

    }

    
}

export async function addCommentToThread(
    threadId:string,
    commentText:string,
    userId:string,
    path:string){
    await connectToDB();

    try{

        console.log("threadId", threadId); //why is it undefined???

        const originalThread = await Thread.findById(threadId);
        if(!originalThread){
            throw new Error("Thread not foundd");
        }

        const commentThread = new Thread({
            text:commentText,
            author: userId,
            parentId:threadId,

        })

        // Save the comment thread to the database
     const savedCommentThread = await commentThread.save();

     // Add the comment thread's ID to the original thread's children array
     originalThread.children.push(savedCommentThread._id);

     // Save the updated original thread to the database
     await originalThread.save();

     revalidatePath(path);
    } catch (err: any) {
    console.error("Error while adding comment:", err.message);
    throw new Error("Unable to add comment");
    }
}